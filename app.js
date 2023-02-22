const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//MiddleWare function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken == undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.variable = request.params;
        request.variables = request.body;
        next();
      }
    });
  }
};

//Login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user where username='${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get all states
app.get("/states/", async (request, response) => {
  let jwtToken;

  function convertToCamel(dbObject) {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    };
  }
  const authHeader = request.headers["authorization"];
  console.log(authHeader);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    // console.log(jwtToken);
  }
  if (jwtToken == undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
    console.log(jwtToken);
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        const getStateQuery = `SELECT * FROM state;`;
        const statesDetails = await db.all(getStateQuery);
        response.send(statesDetails.map((state) => convertToCamel(state)));
      }
    });
  }
});

//Get state API3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.variable;
  function convertToCamel(dbObject) {
    return {
      stateId: dbObject.state_id,
      stateName: dbObject.state_name,
      population: dbObject.population,
    };
  }
  const getStateQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const stateDetails = await db.get(getStateQuery);
  response.send(convertToCamel(stateDetails));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = request.variables;
  console.log(request.variables);
  const addDistrictQuery = `INSERT INTO district
   (district_name,state_id,cases,cured,active,deaths)
   VALUES (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
   )`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//API 5 get district
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.variable;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id=${districtId}`;

    function convertToCamel(dbObject) {
      return {
        districtId: dbObject.district_id,
        districtName: dbObject.district_name,
        stateId: dbObject.state_id,
        cases: dbObject.cases,
        cured: dbObject.cured,
        active: dbObject.active,
        deaths: dbObject.deaths,
      };
    }

    const districtDetails = await db.get(getDistrictQuery);
    response.send(convertToCamel(districtDetails));
  }
);

//API 6 delete district
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.variable;
    const getDistrictQuery = `DELETE FROM district WHERE district_id=${districtId}`;

    await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);

//API 4
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.variable;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.variables;
    const updateDistrictQuery = `UPDATE district SET
        district_name='${districtName}',
       state_id= ${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
       deaths= ${deaths}
       WHERE district_id=${districtId}
   `;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API8

//API7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT SUM(cases) ,
    SUM(cured) ,
    SUM(active) ,
    SUM(deaths) 
    FROM district WHERE state_id=${stateId}
    ;`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
