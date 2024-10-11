const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken")
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "growth.db");

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


app.get("/users/", async (request, response) => {

  const allUsersQuery = `SELECT * FROM users;`;
  const allUsers = await db.all(allUsersQuery);
  response.send(allUsers);
});



app.post("/userRegister/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10); 

  const SelectusersQuery = `
  SELECT * FROM users WHERE username = '${username}'`;

  const dbUser = await db.get(SelectusersQuery);
  if (dbUser === undefined) {
    const createUsersQuery = `
    INSERT INTO 
    users (username, password)
    VALUES 
    (
    '${username}',
    '${hashedPassword}' 
    );`;

    await db.run(createUsersQuery);
    response.send("User created successfully");
  } else {
    response.status(400).send("User already exists");
  }
});

app.post("/userlogin", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "Yuvarakesh");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});




app.get("/admins/", (request, response) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "Yuvarakesh", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        const getadminsQuery = `
            SELECT
              *
            FROM
            admins;`;
        const adminArray = await db.all(getadminsQuery);
        response.send(adminArray);
      }
    });
  }
})



app.get("/allAssignments/",async (request,response)=>{
const allAssignmentsQuery = `
  SELECT * FROM assignments`;
 allAssignments = await db.all(allAssignmentsQuery);
 response.send(allAssignments);

})




app.post("/assignments/upload", async (request, response) => {
  const { userId, task, admin } = request.body; // Expecting userId and admin as usernames
  let jwtToken;
  const authHeader = request.headers["authorization"];
  
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  
  if (jwtToken === undefined) {
    return response.status(401).send("Invalid Access Token");
  }

  
  jwt.verify(jwtToken, "Yuvarakesh", async (error, payload) => {
    if (error) {
      return response.status(401).send("Invalid Access Token");
    } else {
    
      const selectUserIdQuery = `SELECT id FROM users WHERE username = ?`;
      const dbUser = await db.get(selectUserIdQuery, [userId]);

      if (dbUser === undefined) {
        return response.status(400).send("User not found");
      }

      
      const selectAdminIdQuery = `SELECT id FROM admins WHERE username = ?`;
      const dbAdmin = await db.get(selectAdminIdQuery, [admin]);

      if (dbAdmin === undefined) {
        return response.status(400).send("Admin not found");
      }

   
      const uploadAssignmentQuery = `
        INSERT INTO assignments (userId, task, adminId, status, createdAt)
        VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP);
      `;

      await db.run(uploadAssignmentQuery, [dbUser.id, task, dbAdmin.id]);
      response.send("Assignment uploaded successfully");
    }
  });
});


app.post("/adminRegister/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10); 
  const SelectaddAdminsQuery = `
  SELECT * FROM admins WHERE username = '${username}'`;
  const dbUser = await db.get(SelectaddAdminsQuery);
  if (dbUser === undefined) {
    const createadminsQuery = `
    INSERT INTO 
    admins (username, password)
    VALUES 
    (
    '${username}',
    '${hashedPassword}' 
    );`;
    await db.run(createadminsQuery);
    response.send("admin created successfully");
  } else {
    response.status(400).send("admin already exists");
  }
});


app.post("/adminlogin", async (request, response) => {
  const { username, password } = request.body;
  const selectadminloginQuery = `SELECT * FROM admins WHERE username = '${username}'`;
  const dbUser = await db.get(selectadminloginQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "pardhu");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});



app.get("/assignments", async (request, response) => {
  const authHeader = request.headers["authorization"];
  if (!authHeader) {
    return response.status(401).send("Invalid Access Token");
  }

  const jwtToken = authHeader.split(" ")[1];

  jwt.verify(jwtToken, "pardhu", async (error, payload) => {
    if (error) {
      return response.status(401).send("Invalid Access Token");
    }

    const username = payload.username;
    const selectAdminQuery = `SELECT id FROM admins WHERE username = ?`;
    const dbAdmin = await db.get(selectAdminQuery, [username]);

    if (!dbAdmin) {
      return response.status(400).send("Admin not found");
    }

    const assignmentsQuery = `SELECT * FROM assignments WHERE adminId = ?`;
    const assignments = await db.all(assignmentsQuery, [dbAdmin.id]);

    response.send(assignments);
  });
});


app.post("/assignments/:id/accept", async (request, response) => {
  const { id } = request.params;
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    return response.status(401).send("Invalid Access Token");
  }

  jwt.verify(jwtToken, "pardhu", async (error, payload) => {
    if (error) {
      return response.status(401).send("Invalid Access Token");
    } else {
      const updateAssignmentQuery = `
        UPDATE assignments
        SET status = 'accepted'
        WHERE id = ?;
      `;
      await db.run(updateAssignmentQuery, [id]);
      response.send("Assignment accepted successfully");
    }
  });
});


app.post("/assignments/:id/reject", async (request, response) => {
  const { id } = request.params;
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    return response.status(401).send("Invalid Access Token");
  }

  jwt.verify(jwtToken, "pardhu", async (error, payload) => {
    if (error) {
      return response.status(401).send("Invalid Access Token");
    } else {
      const updateAssignmentQuery = `
        UPDATE assignments
        SET status = 'rejected'
        WHERE id = ?;
      `;
      await db.run(updateAssignmentQuery, [id]);
      response.send("Assignment rejected successfully");
    }
  });
});
