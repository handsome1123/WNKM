const express = require('express');
const path = require('path');
const bcrypt = require("bcrypt");
const session = require('express-session');
const bodyparser = require('body-parser');
const MemoryStore = require('memorystore')(session);
const con = require('./config/db');

const app = express();

// Check database connection
con.connect(function (err) {
    if (err) {
        console.error('Error connecting to database.');
        return;
    }
    console.log('Connected to database');
});

// set the public folder
app.use('/public', express.static(path.join(__dirname, 'public')));

// Body-parser middleware
app.use(bodyparser.urlencoded({ extended: true }));
app.set(bodyparser.json())

// set the view engine to ejs
app.set('view engine', 'ejs');

// for session
app.use(session({
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, //1 day in millisec
    secret: 'mysecretcode',
    resave: false,
    saveUninitialized: true,
    // config MemoryStore here
    store: new MemoryStore({
        checkPeriod: 24 * 60 * 60 * 1000 // prune expired entries every 24h
    })
}));


//render signup page
app.get('/signup', (req, res) => {
    res.render('register');
});

// render signin page
app.get('/', (req, res) => {
    res.render('loginPage');
});


// Handle POST request for user signup
app.post('/signup', async (req, res) => {
    const { username, password, email } = req.body;

    try {
        // Check if email already exists
        con.query('SELECT * FROM users WHERE email = ?', [email], async (error, results) => {
            if (error) {
                console.error('Error checking existing email:', error);
                return res.status(500).json({ message: 'Error checking existing email' });
                //   return res.redirect('/signup');
            }

            if (results.length > 0) {
                // Email already exists
                return res.redirect('/');
                return res.status(500).json({ message: 'Email already exists' });
            }
            try {
                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert new user into the database
                con.query('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email], (error, results) => {
                    if (error) {
                        console.error('Error creating new user:', error);
                        return res.status(500).json({ message: 'Error creating new user' });
                    }
                    // User registered successfully
                    return res.redirect('/');
                });
            } catch (error) {
                console.error('Error hashing password:', error);
                return res.redirect('/');
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return res.redirect('/signup');
    }
});

// Handle POST request for user signin
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    // Find user by email
    con.query('SELECT * FROM users WHERE email = ?', [email], async (error, results) => {
        if (error) {
            console.error('Error finding user:', error);
            return res.status(500).send('Internal server error');
        }

        if (results.length === 0) {
            // User not found
            req.flash('message', 'User not found');
            return res.redirect('/');
        }

        // Compare password
        const user = results[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            // Password incorrect
            req.flash('message', 'Incorrect Password');
            return res.redirect('/');
        }

        // Set user session
        req.session.userId = user.user_id;

        // Redirect to respective dashboard based on user role
        switch (user.role) {
            case 'staff':
                return res.redirect('/staff_home');
            case 'lecturer':
                return res.redirect('/approver_home');
            case 'user':
                return res.redirect('/student_home');
            default:
                return res.status(400).send('Unknown User Role!');
        }
    });
});

// Render user dashboard
app.get('/student_home', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // User found, extract user information
        const user = results[0];

        // Check if the user is a lecturer
        if (user.role !== 'user') {
            // If the user is not a lecturer, deny access
            // return res.status(403).send('Access forbidden');
            return res.redirect('/');
        }

        // Render the user dashboard page with user information and rooms
        res.render('use/Homestu', { user, userId});
    });
});

// Render browse room
app.get('/student/browse_room', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }

    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // User found, extract user information
        const user = results[0];

        // Check if the user is a lecturer
        if (user.role !== 'user') {
            // If the user is not a lecturer, deny access
            // return res.status(403).send('Access forbidden');
            return res.redirect('/');
        }

        // Retrieve user information based on the session
        const userId = req.session.userId;
        con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
            if (error) {
                console.error('Error retrieving user information:', error);
                return res.status(500).json({ message: 'Internal server error' });
            }

            // If the user is not found, send a 404 response
            if (results.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            // User found, extract user information
            const user = results[0];

            // Check if the user is a lecturer
            if (user.role !== 'user') {
                // If the user is not a lecturer, deny access
                // return res.status(403).send('Access forbidden');
                return res.redirect('/');
            }

            // Query to fetch rooms
            const roomsQuery = 'SELECT *, CONCAT("/img/", image_path) AS image_path FROM rooms';
            con.query(roomsQuery, (error, rooms) => {
                if (error) {
                    console.error('Error retrieving rooms:', error);
                    return res.status(500).json({ message: 'Internal server error' });
                }

                // Query to fetch time slots for each room
                const slotsQuery = 'SELECT * FROM time_slots';
                con.query(slotsQuery, (error, time_slots) => {
                    if (error) {
                        console.error('Error retrieving time slots:', error);
                        return res.status(500).json({ message: 'Internal server error' });
                    }

                    // Organize time slots by room
                    rooms.forEach(room => {
                        room.timeSlots = time_slots.filter(slot => slot.room_id === room.room_id);
                    });

                    // Render the user dashboard page with user information and rooms
                    res.render('use/BrowStu', { user, userId, rooms });
                });
            });
        });
    });
});

// Render booking form
app.get('/booking', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
      // Redirect the user to the login page
      return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        // Flash a generic error message
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a flash message and redirect
      if (results.length === 0) {
        return res.redirect('/');
      }
  
      // User found, extract user information
      const user = results[0];
  
      // Check if the user is a lecturer
      if (user.role !== 'user') {
        // If the user is not a lecturer, flash a message and redirect
        return res.redirect('/');
      }
  
      // Retrieve roomId and slotId from query parameters
      const { roomId, slotId } = req.query;
  
      // Assuming you fetch the room name, room picture path, start time, and end time based on roomId and slotId from your database
      const roomQuery = 'SELECT room_name, image_path FROM rooms WHERE room_id = ?';
      con.query(roomQuery, [roomId], (error, room) => {
        if (error) {
          console.error('Error fetching room details:', error);
          return res.status(500).send('Internal Server Error');
        }
  
        // Check if room array is empty or not
        if (!room || room.length === 0) {
          console.error('Room not found or empty');
          return res.redirect('/booking');
        }
  
        // Assuming you fetch the start time and end time based on slotId
        const slotQuery = 'SELECT start_time, end_time FROM time_slots WHERE slot_id = ?';
        con.query(slotQuery, [slotId], (error, slot) => {
          if (error) {
            console.error('Error fetching time slot:', error);
            req.flash('error', 'Internal Server Error. Please try again later.');
            return res.status(500).send('Internal Server Error');
          }
  
          // Check if slot array is empty or not
          if (!slot || slot.length === 0) {
            console.error('Slot not found or empty');
            req.flash('error', 'Slot not found.');
            return res.redirect('/');
          }
  
          // Render the booking form with the provided data
          res.render('use/BookingFormStu', {
            roomId: roomId,
            roomName: room[0].room_name,
            roomImage: room[0].image_path,
            startTime: slot[0].start_time,
            endTime: slot[0].end_time,
            slotId: slotId,
            userId: userId,
            user: user,
          });
        });
      });
    });
});

// Route for booking a time slot
app.post('/booking', (req, res) => {
    // Check if the user is logged in
  if (!req.session || !req.session.userId) {
    // If the user is not logged in, redirect them to the login page
    return res.redirect('/');
  }
  
  // Retrieve user information based on the session
  const userId = req.session.userId;
  con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
    if (error) {
      console.error('Error retrieving user information:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  
    // If the user is not found, send a 404 response
    if (results.length === 0) {
      return res.redirect('/');
    }
  
    // User found, extract user information
    const user = results[0];
  
      // Check if the user is a lecturer
      if(user.role !== 'user') {
        // If the user is not a lecturer, deny access
        return res.redirect('/');
      }
  
    // Retrieve data from the request body
    const { roomId, slotId, objective } = req.body;
  
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
  
    // Get current hour and minutes
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
  
    // Combine current time to get current time in HH:MM format
    const currentTime = currentHour + ':' + currentMinute;
  
    // Retrieve time slots from the database
    con.query('SELECT * FROM time_slots WHERE slot_id = ? AND start_time > ? ORDER BY start_time ASC', [slotId, currentTime], (error, results) => {
      if (error) {
        console.error('Error retrieving time slots:', error);
        return res.status(500).send('Internal server error');
      }
  
      // If there are no available time slots for today, return an error
      if (results.length === 0) {
        
        // return res.status(400).send('No available time slots for today');
        return res.redirect('/student/browse_room');
      }
  
      // Check if the student has already booked a slot for today
      con.query('SELECT * FROM bookings WHERE user_id = ? AND date = ?', [userId, today], (error, results) => {
        if (error) {
          console.error('Error checking existing bookings:', error);
          return res.status(500).send('Internal server error');
        }
  
        // If the student has already booked a slot for today, return an error
        if (results.length > 0) {
            // return res.status(400).send('Student can only book a single slot per day');
          // Redirect back to the booking page with query parameters  
          return res.redirect('/student/browse_room');
          
        }
  
        // Insert booking record into the database
        con.query('INSERT INTO bookings (user_id, room_id, slot_id, objective, status, action_by, date) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, roomId, slotId, objective, 'pending', userId, today], (error, results) => {
          if (error) {
            console.error('Error creating booking:', error);
            return res.status(500).send('Internal server error');
          }
  

          // Update the status of the room's time slots to "pending"
          con.query('UPDATE time_slots SET status = ? WHERE slot_id = ?', ['pending', slotId], (error, results) => {
            if (error) {
              console.error('Error updating time slot status:', error);
              return res.status(500).send('Internal server error');
  
            }
              return res.redirect('/student/checking_requests');
          });
        });
      });
    });
  });
  });

// Render user booking request page
app.get('/student/checking_requests', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
      // If the user is not logged in, redirect them to the login page
      return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
      // Check if the user is not a lecturer
      if (user.role !== 'user') {
        // If the user is not a lecturer, deny access
        return res.redirect('/');
      }
  
      // Query database to get pending booking requests for the specific login user ID
      const query = `
        SELECT bookings.*, rooms.room_name, time_slots.start_time, time_slots.end_time, rooms.image_path
        FROM bookings 
        JOIN rooms ON bookings.room_id = rooms.room_id 
        JOIN time_slots ON bookings.slot_id = time_slots.slot_id 
        WHERE bookings.status = 'pending' 
          AND bookings.user_id = ?`;
  
      con.query(query, [userId], (error, bookings) => {
        if (error) {
          // Handle error
          console.error('Error fetching bookings:', error);
          return res.status(500).send('Internal Server Error');
        }
        // Render the user's booking request page with bookings data
        res.render('use/CheckToStu', { user, bookings });
      });
    });
  });

// =========== for approver =======
// approver home page 
app.get('/approver_home', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // User found, extract user information
        const user = results[0];

        // Check if the user is a lecturer
        if (user.role !== 'lecturer') {
            // If the user is not a lecturer, deny access
            // return res.status(403).send('Access forbidden');
            return res.redirect('/');
        }

        // Render the user dashboard page with user information and rooms
        res.render('app/Homeapp', { user, userId});
    });
});

// Render room lists for approver
app.get('/approver/browse_room', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
      // If the user is not logged in, redirect them to the login page
      return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
        // Check if the user is a lecturer
        if(user.role !== 'lecturer') {
          // If the user is not a lecturer, deny access
          // return res.status(403).send('Access forbidden');
          return res.redirect('/');
        }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
    // Check if the user is a lecturer
    if(user.role !== 'lecturer') {
      // If the user is not a lecturer, deny access
      // return res.status(403).send('Access forbidden');
      return res.redirect('/');
    }
  
      // Query to fetch rooms
      const roomsQuery = 'SELECT *, CONCAT("/img/", image_path) AS image_path FROM rooms';
      con.query(roomsQuery, (error, rooms) => {
        if (error) {
          console.error('Error retrieving rooms:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
  
        // Query to fetch time slots for each room
        const slotsQuery = 'SELECT * FROM time_slots';
        con.query(slotsQuery, (error, time_slots) => {
          if (error) {
            console.error('Error retrieving time slots:', error);
            return res.status(500).json({ message: 'Internal server error' });
          }
  
          // Organize time slots by room
          rooms.forEach(room => {
            room.timeSlots = time_slots.filter(slot => slot.room_id === room.room_id);
          });
  
          // Render the user dashboard page with user information and rooms
          res.render('app/BrowApp', { user, userId, rooms });
        });
      });
    });
  });
});

// Render user booking request page
app.get('/approver/booking-requests', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
      // If the user is not logged in, redirect them to the login page
      return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
      // Check if the user is a lecturer
      if(user.role !== 'lecturer') {
        // If the user is not a lecturer, deny access
        // return res.status(403).send('Access forbidden');
        return res.redirect('/');
      }
  
      // Query database to get all pending booking request
      const query = "SELECT bookings.*, rooms.room_name, time_slots.start_time, time_slots.end_time, rooms.image_path " +
        "FROM bookings " +
        "JOIN rooms ON bookings.room_id = rooms.room_id " +
        "JOIN time_slots ON bookings.slot_id = time_slots.slot_id " +
        "WHERE bookings.status = 'pending'";
  
      con.query(query, (error, bookings) => {
        if (error) {
          // Handle error
          console.error('Error fecting bookings:', error);
          return res.status(500).send('Internal Server Error');
        }
        // Render the lecturer dashboard with bookings data
        res.render('app/CheckToApp', { user, bookings: bookings })
  
      });
    });
  });
  
  // Endpoint to handle booking approval
  app.post('/approver/approve-booking', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    const { bookingId } = req.body;
  
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
  
        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
  
        // User found, extract user information
        const user = results[0];
  
        // Check if the user is a lecturer
        if(user.role !== 'lecturer') {
          // If the user is not a lecturer, deny access
          // return res.status(403).send('Access forbidden');
          return res.redirect('/');
        }
  
        // Update booking status to 'approved' and set action_by to the current user ID
        const updateBookingQuery = 'UPDATE bookings SET status = ?, action_by = ? WHERE id = ?';
        con.query(updateBookingQuery, ['approved', userId, bookingId], (err, result) => {
            if (err) {
                console.error('Error approving booking:', err);
                return res.status(500).send('Internal Server Error');
            }
  
            // Update status of the associated time slot in the time_slots table to 'reserved'
            const updateSlotQuery = 'UPDATE time_slots SET status = "reserved" WHERE slot_id = (SELECT slot_id FROM bookings WHERE id = ?)';
            con.query(updateSlotQuery, [bookingId], (error, result) => {
                if (error) {
                    console.error('Error updating slot status:', error);
                    return res.status(500).send('Internal Server Error');
                }
                // Redirect back to the dashboard or any other appropriate page
                res.redirect('/approver/browse_room');
            });
        });
    });
  });
  
  // Endpoint to handle booking reject
  app.post('/approver/reject-booking', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    const { bookingId } = req.body;
  
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
  
        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
  
        // User found, extract user information
        const user = results[0];
  
        // Check if the user is a lecturer
        if(user.role !== 'lecturer') {
          // If the user is not a lecturer, deny access
          // return res.status(403).send('Access forbidden');
          return res.redirect('/');
        }
  
        // Update booking status to 'approved' and set action_by to the current user ID
        const updateBookingQuery = 'UPDATE bookings SET status = ?, action_by = ? WHERE id = ?';
        con.query(updateBookingQuery, ['rejected', userId, bookingId], (err, result) => {
            if (err) {
                console.error('Error rejecting booking:', err);
                return res.status(500).send('Internal Server Error');
            }
  
            // Update status of the associated time slot in the time_slots table to 'reserved'
            const updateSlotQuery = 'UPDATE time_slots SET status = "free" WHERE slot_id = (SELECT slot_id FROM bookings WHERE id = ?)';
            con.query(updateSlotQuery, [bookingId], (error, result) => {
                if (error) {
                    console.error('Error updating slot status:', error);
                    return res.status(500).send('Internal Server Error');
                }
                
                // Redirect back to the dashboard or any other appropriate page
                res.redirect('/approver/browse_room');
            });
        });
    });
  
  });
  


// =========== for staff =======
// staff home page 
app.get('/staff_home', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
        // If the user is not logged in, redirect them to the login page
        return res.redirect('/');
    }
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error retrieving user information:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        // If the user is not found, send a 404 response
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // User found, extract user information
        const user = results[0];

        // Check if the user is a lecturer
        if (user.role !== 'staff') {
            // If the user is not a lecturer, deny access
            // return res.status(403).send('Access forbidden');
            return res.redirect('/');
        }

        // Render the user dashboard page with user information and rooms
        res.render('sta/Homesta', { user, userId});
    });
});

// Render room lists for Staff
app.get('/staff/browse_room', (req, res) => {
    // Check if the user is logged in
    if (!req.session || !req.session.userId) {
      // If the user is not logged in, redirect them to the login page
      return res.redirect('/');
    }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
        // Check if the user is a lecturer
        if(user.role !== 'staff') {
          // If the user is not a lecturer, deny access
          // return res.status(403).send('Access forbidden');
          return res.redirect('/');
        }
  
    // Retrieve user information based on the session
    const userId = req.session.userId;
    con.query('SELECT * FROM users WHERE user_id = ?', [userId], (error, results) => {
      if (error) {
        console.error('Error retrieving user information:', error);
        return res.status(500).json({ message: 'Internal server error' });
      }
  
      // If the user is not found, send a 404 response
      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // User found, extract user information
      const user = results[0];
  
    // Check if the user is a lecturer
    if(user.role !== 'staff') {
      // If the user is not a lecturer, deny access
      // return res.status(403).send('Access forbidden');
      return res.redirect('/');
    }
  
      // Query to fetch rooms
      const roomsQuery = 'SELECT *, CONCAT("/img/", image_path) AS image_path FROM rooms';
      con.query(roomsQuery, (error, rooms) => {
        if (error) {
          console.error('Error retrieving rooms:', error);
          return res.status(500).json({ message: 'Internal server error' });
        }
  
        // Query to fetch time slots for each room
        const slotsQuery = 'SELECT * FROM time_slots';
        con.query(slotsQuery, (error, time_slots) => {
          if (error) {
            console.error('Error retrieving time slots:', error);
            return res.status(500).json({ message: 'Internal server error' });
          }
  
          // Organize time slots by room
          rooms.forEach(room => {
            room.timeSlots = time_slots.filter(slot => slot.room_id === room.room_id);
          });
  
          // Render the user dashboard page with user information and rooms
          res.render('sta/BrowSta', { user, userId, rooms });
        });
      });
    });
  });
});

// Render Logout
app.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }
        // Redirect to the login page after logout
        res.redirect('/');
    });
});

const PORT = 8000;
app.listen(PORT, function () {
    console.log('Server is running .....');
});