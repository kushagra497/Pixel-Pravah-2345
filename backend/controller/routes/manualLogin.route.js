const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../models/user.model");
const { blacklistModel } = require("../../models/blacklist.model");
const cookieparser = require("cookie-parser");
const {generateOtp,sendEmailVerification}=require('../../controller/middlewares/otpRegistration.middleware');
const {redisClient}=require('../../controller/middlewares/redis.middleware');
const {auth} = require("../middlewares/auth.middleware")

const userRouter = express.Router();
userRouter.use(cookieparser());


userRouter.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ user_data: users });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});



userRouter.post("/register", async (req, res) => {
  const { username, email, password,otp } = req.body;

  try {
    if (
      !/[A-Z]/.test(password) ||
      !/\d/.test(password) ||
      !/[!@#$%^&*()_+{}[;]/.test(password) ||
      password.length < 8
    ) {
      return res.status(400).json({ msg: "Cannot register" });
    }
      if (email || username) {
        const existEmailUser = await User.findOne({ email });
        const existnameUser = await User.findOne({ username });
        console.log(existnameUser)
        if (existEmailUser) {
          return res.status(400).json({ msg: "Email already exists" });
        }
        if (existnameUser) {
          return res.status(400).json({ msg: "username already exists" });
        }

        const storedOTP = await redisClient.get(email);
        if(storedOTP && storedOTP === otp){
            const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        res
          .status(200)
          .json({ msg: "User registered successfully", registeredUser: user });
           
        }else{
            console.log(storedOTP," ",otp);
            res.status(400).json({error:"Invalid or expired OTP.Please request a new otp"})
        } 
      // }
    }
  } catch (err) {
    res.status(400).json({ error: err });
  }
});
userRouter.post('/send-otp',async(req,res)=>{
    const {email}=req.body;

    
    const otp=generateOtp();
    try{
            if (email) {
              const existEmailUser = await User.findOne({ email });
              if (existEmailUser) {
                return res.status(400).json({ msg: "Email already exists" });
              }
                await redisClient.setex(email,120,otp.toString());
                sendEmailVerification(email,otp);
                res.status(200).json({msg:"OTP sent successfully"});

            }
    }catch(err){
        res.status(500).json(err)
    }
})

userRouter.post("/login", async (req, res) => {
  const { emailOrUserName, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUserName }, { username: emailOrUserName }],
    });

    if (user) {
      bcrypt.compare(password, user.password, (err, result) => {
        if (err) {
          res.status(400).json({ msg: "User does not exist!!!" });
        }
        if (result) {
          const access_token = jwt.sign(
            { userID: user._id, username: user.username },
            "SocialSnap",
            { expiresIn: "7d" }
          );
          const refresh_token = jwt.sign(
            { userID: user._id, username: user.username },
            "SocialSnap",
            { expiresIn: "14d" }
          );

          res.cookie("access_token", access_token, { httpOnly: true });
          res.cookie("refresh_token", refresh_token, { httpOnly: true });

          res.status(200).json({
            msg: "Login successful!",
            name: user.username,
            access_token,
            refresh_token,
          });
        } else {
          res.status(400).json({ msg: "Incorrect password!" });
        }
      });
    } else {
      res.status(400).json({ msg: "User does not exist!!!" });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



userRouter.get("/logout", async (req, res) => {
  const access_token = req.cookies.access_token;
  const refresh_token = req.cookies.refresh_token;

  try {
    const blacklist = new blacklistModel({ access_token, refresh_token });
    await blacklist.save();

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    res.status(200).json({ msg: "User has been logged out" });
  } catch (err) {
    res.status(400).json({ error: err });
    console.log(err)
  }
});



// Get USER DETAILS
userRouter.get('/:user_id', async (req, res) => {
  const userId = req.params.user_id;

  try {

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user found, send user details in the response
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = {
  userRouter,
};
// jvn