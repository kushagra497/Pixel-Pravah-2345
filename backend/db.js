const mongoose=require('mongoose');
require('dotenv').config();
const connection=mongoose.connect("mongodb+srv://sourav:anand@cluster0.oixi3wp.mongodb.net/RaceGame?retryWrites=true&w=majority&appName=Cluster0");

module.exports={
    connection
}