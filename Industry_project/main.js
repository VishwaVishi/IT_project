const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Added to parse JSON bodies
app.use(express.static(__dirname));

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './db' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));

const userDb = new sqlite3.Database(process.env.DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error when connecting to the user database', err.message);
        return;
    }
    console.log('Connected to the SQLite user database.');

    userDb.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user'
    )`, (err) => {
        if (err) {
            console.error('Error creating users table', err.message);
        } else {
            // Add the fixed admin account
            const adminEmail = 'admin@gmail.com';
            const adminPassword = 'admin@123';
            const hashedAdminPassword = bcrypt.hashSync(adminPassword, 10);

            userDb.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
                ['admin', adminEmail, hashedAdminPassword, 'admin'], (err) => {
                    if (err) {
                        console.error('Error adding admin account', err.message);
                    } else {
                        console.log('Admin account initialized.');
                    }
                });
        }
    });
});

const booksDb = new sqlite3.Database(process.env.BOOKS_DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error when connecting to the books database', err.message);
        return;
    }
    console.log('Connected to the SQLite books database.');
    booksDb.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        publication_year INTEGER,
        genre TEXT,
        isbn TEXT,
        publisher TEXT,
        available TEXT,
        borrower_id TEXT,
        due_date TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating books table', err.message);
        }
    });
});

function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/');
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).send('Forbidden: Admins only');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirm_password } = req.body;
    const role = 'user'; // Default role
    if (password !== confirm_password) {
        return res.send(`<script>alert('Passwords do not match.'); window.location.href='/register';</script>`);
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        userDb.run(`INSERT INTO users(username, email, password, role) VALUES(?, ?, ?, ?)`, [username, email, hashedPassword, role], (err) => {
            if (err) {
                return res.send(`<script>alert('Error registering new user.'); window.location.href='/register';</script>`);
            }
            res.send(`<script>alert('Registration successful!'); window.location.href='/';</script>`);
        });
    } catch (err) {
        return res.send(`<script>alert('Error processing your request.'); window.location.href='/register';</script>`);
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    userDb.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            return res.send(`<script>alert('Error retrieving user.'); window.location.href='/';</script>`);
        }
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.send(`<script>alert('Incorrect email or password.'); window.location.href='/';</script>`);
        }
        req.session.user = user;
        if (user.role === 'admin') {
            res.send(`<script>alert('Login successful!'); window.location.href='/admin_dashboard.html';</script>`);
        } else {
            res.send(`<script>alert('Login successful!'); window.location.href='/users_dashboard.html';</script>`);
        }
    });
});

app.get('/users/:username', isAuthenticated, (req, res) => {
    const { username } = req.params;
    userDb.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.send(`<script>alert('Error retrieving user.'); window.location.href='/';</script>`);
        }
        if (user) {
            res.json(user);
        } else {
            res.send(`<script>alert('User not found.'); window.location.href='/';</script>`);
        }
    });
});

// Admin dashboard route
app.get('/admin_dashboard.html', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin_dashboard.html'));
});



// Fetch all books for users
app.get('/books', isAuthenticated, (req, res) => {
    booksDb.all(`SELECT * FROM books`, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching books');
        }
        res.json(rows);
    });
});

// Add book route
app.post('/add-book', isAdmin, (req, res) => {
    const { title, author, publication_year, genre, isbn, publisher, available } = req.body;
    booksDb.run(`INSERT INTO books (title, author, publication_year, genre, isbn, publisher, available) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, author, publication_year, genre, isbn, publisher, available], (err) => {
            if (err) {
                return res.send(`<script>alert('Error adding book.'); window.location.href='/admin_dashboard.html';</script>`);
            }
            res.send(`<script>alert('Book added successfully!'); window.location.href='/admin_dashboard.html';</script>`);
        });
});

// Update book availability
app.post('/update-book', isAdmin, (req, res) => {
    const { id, available } = req.body;
    if (!id || !available) {
        return res.status(400).send('Missing required fields');
    }

    console.log(`Updating book id: ${id} with availability: ${available}`); // Log for debugging

    booksDb.run(`UPDATE books SET available = ? WHERE id = ?`, [available, id], (err) => {
        if (err) {
            console.error('Error updating book:', err);
            return res.status(500).send('Error updating book');
        }
        console.log('Book updated successfully'); // Log for debugging
        res.send('Book updated successfully');
    });
});

// Delete book
app.delete('/delete-book/:id', isAdmin, (req, res) => {
    const { id } = req.params;
    booksDb.run(`DELETE FROM books WHERE id = ?`, [id], (err) => {
        if (err) {
            return res.status(500).send('Error deleting book');
        }
        res.status(200).send('Book deleted successfully');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/dashboard');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('/reset', (req, res) => {
    res.sendFile(path.join(__dirname, 'reset_password.html'));
});

app.post('/reset-password', async (req, res) => {
    const { email, new_password, confirm_new_password } = req.body;
    if (new_password !== confirm_new_password) {
        return res.send(`<script>alert('Passwords do not match.'); window.location.href='/reset';</script>`);
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    userDb.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) {
            return res.send(`<script>alert('Error retrieving user.'); window.location.href='/reset';</script>`);
        }
        if (user) {
            userDb.run(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, email], (err) => {
                if (err) {
                    return res.send(`<script>alert('Error updating password.'); window.location.href='/reset';</script>`);
                }
                res.send(`<script>alert('Password successfully updated!'); window.location.href='/';</script>`);
            });
        } else {
            res.send(`<script>alert('No account with that email address exists.'); window.location.href='/reset';</script>`);
        }
    });
});

// User dashboard route
app.get('/users_dashboard.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'users_dashboard.html'));
});

// Fetch all books for users
app.get('/books', isAuthenticated, (req, res) => {
    booksDb.all(`SELECT * FROM books`, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching books');
        }
        res.json(rows);
    });
});

// Book download route
app.get('/download/:bookId', isAuthenticated, (req, res) => {
    const bookId = req.params.bookId;
    booksDb.get(`SELECT * FROM books WHERE id = ?`, [bookId], (err, book) => {
        if (err || !book) {
            return res.status(404).send('Book not found');
        }
        const filePath = path.join(__dirname, 'books', `${book.id}.pdf`);
        res.download(filePath);
    });
});


// Add this line instead:
app.listen(3000, () => {
    console.log('Server is running on port 3000.');
});