const express = require("express");
const path = require("path");
const bcrypt= require("bcrypt")
const jwt = require("jsonwebtoken")

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error : ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const convertStateDbToResponse =(obj)=>({
stateId:obj.state_id,
stateName:obj.state_name,
population:obj.population
})


const convertDistrictDbToResponse =(obj)=>({
districtId:obj.district_id,
districtName:obj.district_name,
stateId:obj.state_id,
cases:obj.cases,
cured:obj.cured,
active:obj.active,
deaths:obj.deaths,
})

//api 1 scenario 1
app.post("/login/", async (request, response) => {
   const {username,password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username ='${username}'`;

  const user = await db.get(getUserQuery)
if(user===undefined){
    response.status(400)
     response.send("Invalid user")
}else{
    const hashedPass = user.password
    const isPassValid = await bcrypt.compare(password,hashedPass)
    if(!isPassValid){
        response.status(400)
        response.send("Invalid password")
    }
    else{
        const payload={username}
        const jwtToken = await jwt.sign(payload,"secret")
        console.log(jwtToken)
        response.send({jwtToken:jwtToken})
    }
}
});

const authenticateToken   =  async (request,response,next)=>{
   let jwtToken
    const authHeader = await request.headers["authorization"]
    if(authHeader!==undefined){
        jwtToken = await authHeader.split(" ")[1]
        console.log(jwtToken)
    }
    if(jwtToken===undefined){
        console.log(jwtToken)
        response.status(401)
        response.send("Invalid JWT Token")
        console.log("token not available")
    }
    else{
        await jwt.verify(jwtToken,"secret",(error,payload)=>{
        if(error){
             response.status(401)
            response.send("Invalid JWT Token")
            console.log("wrong token")
        }   
        else{
           next()
        }
    })
}
}

app.get("/states/",authenticateToken,async (request,response)=>{
   const StatesQuery=`SELECT * FROM state`
   const statesArray = await db.all(StatesQuery)
  const statesArray1= statesArray.map(each=>(convertStateDbToResponse(each)))
   response.send(statesArray1)
})

app.get("/states/:stateId/",authenticateToken,async (request,response)=>{
   const {stateId}=request.params
    const StateQuery=`SELECT * FROM state WHERE state_id=${stateId}`
   const state = await db.get(StateQuery)
   const state1 = convertStateDbToResponse(state)
   response.send(state1)
})


app.post("/districts/",authenticateToken,async (request,response)=>{
   const {districtName,stateId,cases,cured,active,deaths}=request.body
    const updateQuery=`INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
     VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths})`
   const dist = await db.run(updateQuery)
      response.send("District Successfully Added")
})


app.put("/districts/:districtId/",authenticateToken,async (request,response)=>{
  const {districtId}=request.params
    const {districtName,stateId,cases,cured,active,deaths}=request.body
    const updateQuery=`UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured =${cured},active=${active},deaths=${deaths}
   WHERE district_id=${districtId}`
    const dist = await db.run(updateQuery)
    response.send("District Details Updated")
})


//get specific district
app.get("/districts/:districtId/",authenticateToken,async (request,response)=>{
   const {districtId}=request.params
    const districtQuery=`SELECT * FROM district WHERE district_id=${districtId}`
   const district = await db.get(districtQuery)
   const district1 = convertDistrictDbToResponse(district)
   response.send(district1)
})

//delete a district
app.delete("/districts/:districtId/",authenticateToken,async (request,response)=>{
   const {districtId}=request.params
    const deleteQuery=`DELETE FROM district 
    WHERE district_id=${districtId}`
   const district = await db.run(deleteQuery)
      response.send("District Removed")
})

app.get("/states/:stateId/stats/",authenticateToken,async (request,response)=>{
   const {stateId}=request.params
    const Query=`SELECT sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths 
    FROM district WHERE state_id=${stateId} GROUP BY state_id`
   const stats = await db.get(Query)
   response.send(stats)
})

module.exports = app
