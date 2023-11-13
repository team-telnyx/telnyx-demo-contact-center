const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();
const crypto = require('crypto');
const algorithm = 'aes-256-ctr';
const secretKey = 'your-encryption-secret-key'; // You should use a .env variable for this

//===================== ENCRYPTION OF SIP CREDENTIALS =====================
// Encryption and decryption utility functions
const encrypt = (text) => {
  const cipher = crypto.createCipher(algorithm, secretKey);
  let crypted = cipher.update(text, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return crypted;
};

const decrypt = (text) => {
  const decipher = crypto.createDecipher(algorithm, secretKey);
  let dec = decipher.update(text, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
};

const authenticateUser = async (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // if no token, return 401 (unauthorized)

  try {
    const decoded = jwt.verify(token, 'yourSecretKey');
    const user = await User.findOne({ where: { username: decoded.username } });
    if (!user) {
      throw new Error('No user found with this username.');
    }
    req.user = user; // Set the user in the request for downstream routes
    next(); // pass the execution off to whatever request the client intended
  } catch (error) {
    res.status(401).json({ message: "Please authenticate." });
  }
};

//===================== REGISTER ENDPOINT =====================
// Register
router.post('/register', async (req, res) => {
  const { username, password, firstName, lastName, phoneNumber } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const { sipUsername, sipPassword } = req.body;
  const encryptedSipPassword = encrypt(req.body.sipPassword);

  try {
    const newUser = await User.create({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      sipUsername,
      sipPassword: encryptedSipPassword,
      avatar: req.body.avatar ? req.body.avatar : null,
      status: false
    });
    res.status(200).json("User registered");
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== GET A AGENT ENDPOINT =====================
// GET a user
router.get('/user_data/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      const { avatar, firstName, lastName, phoneNumber, status } = user;
      res.status(200).json({ avatar, firstName, lastName, phoneNumber, status }); 
    } else {
      res.status(404).json("User not found");
    }

  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== GET ALL AGENTS ENDPOINT =====================
// Get all agents
router.get('/agents', async (req, res) => {
  try {
    const agents = await User.findAll();
    res.status(200).json(agents);
  } catch (err) {
    res.status(500).json(err);
  }
});

//===================== LOGIN ENDPOINT =====================
// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const user = await User.findOne({ where: { username } });
      if (!user) return res.status(400).json("Wrong credentials");
      const validated = await bcrypt.compare(password, user.password);
      if (!validated) return res.status(400).json("Wrong credentials");
      // Generate a token
      const token = jwt.sign({ username: user.username }, 'yourSecretKey', { expiresIn: '1h' });
      // Set the session
      req.session.user = user;
      res.status(200).json({ token });
    } catch (err) {
      res.status(500).json(err);
    }
  });
//===================== LOGOUT ENDPOINT =====================
// Logout
router.post('/logout', (req, res) => {
    // Clear the session
    req.session.destroy((err) => {
      if (err) return res.status(500).json("Could not log out");
    });
  
    // Clear the token (Front-end should delete the token)
    res.status(200).json("Logged out");
  });
//===================== UPDATE AGENT ENDPOINT =====================
// Update User
router.put('/update/:username', async (req, res) => {
  const { username } = req.params;
  const { newPassword, firstName, lastName, phoneNumber, avatar } = req.body;
  const { status } = req.body;
  const { sipUsername, sipPassword } = req.body;

  try {
    const user = await User.findOne({ where: { username } });
    if (status !== undefined) user.status = status;
    if (user) {
      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
      }
      if (sipPassword) {
        const encryptedSipPassword = encrypt(req.body.sipPassword);
        user.sipPassword = encryptedSipPassword;
      }
      if (sipUsername) user.sipUsername = sipUsername;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (avatar) user.avatar = avatar;

      await user.save();

      res.status(200).json("User updated");
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== UPDATE AGENT STATUS ENDPOINT =====================
// Update User Status
router.patch('/update-status/:username', async (req, res) => {
  const { username } = req.params;
  const { status } = req.body;  // Get status from the request body

  if (status === undefined) {
    return res.status(400).json("Status field is required");
  }

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      user.status = status;
      await user.save();
      res.status(200).json({ status: user.status, message: "User status updated" });  // Return updated status
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== DELETE AGENT ENDPOINT =====================
// Delete User
router.delete('/delete/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ where: { username } });

    if (user) {
      await user.destroy();
      res.status(200).json("User deleted");
    } else {
      res.status(404).json("User not found");
    }
  } catch (err) {
    res.status(500).json(err);
  }
});
//===================== SECURED: GET SIP CREDENTIALS ENDPOINT =====================
router.get('/sip-credentials', authenticateUser, async (req, res) => {
  try {
    const { sipUsername, sipPassword } = req.user; // Get SIP credentials from the authenticated user
    const decryptedSipPassword = decrypt(sipPassword);
    res.json({
      sipUsername,
      sipPassword: decryptedSipPassword, 
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
