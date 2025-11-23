# Campus360 - College Issue Reporting System

A comprehensive web application for students to report campus issues and administrators to manage them efficiently.

## Features

- 🔐 **User Authentication**: Secure login with JWT tokens
- 📝 **Issue Reporting**: Students can submit issues with categories, locations, and attachments
- 👨‍💼 **Admin Dashboard**: Administrators can view, filter, and manage all reported issues
- 📊 **Statistics**: Real-time analytics and insights
- 🎨 **Modern UI**: Beautiful, responsive design with dark theme

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: SQLite
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```
   PORT=3000
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

3. **Start the Server**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Open your browser and navigate to `http://localhost:3000`

## Default Admin Credentials

- **Email**: `admin@drait.edu.in`
- **Password**: `principal123`

**Note**: Change the admin password in production!

## API Endpoints

### Authentication
- `POST /api/register` - Register a new user
- `POST /api/login` - Login user
- `GET /api/me` - Get current user info (requires auth)

### Issues
- `POST /api/issues` - Submit a new issue (requires auth)
- `GET /api/issues` - Get all issues (with optional filters)
- `GET /api/issues/:id` - Get a specific issue
- `PATCH /api/issues/:id/status` - Update issue status (admin only)

### Statistics
- `GET /api/statistics` - Get dashboard statistics (admin only)

### Contact
- `POST /api/contact` - Submit contact form

## Database Schema

### Users Table
- `id` - Primary key
- `email` - Unique email address (must be @drait.edu.in)
- `password` - Hashed password
- `role` - User role (student/admin)
- `name` - User's name
- `created_at` - Account creation timestamp

### Issues Table
- `id` - Primary key
- `issue_id` - Unique issue identifier (e.g., ISS0001)
- `title` - Issue title
- `category` - Issue category
- `location` - Issue location
- `description` - Detailed description
- `status` - Issue status (pending/in-progress/resolved)
- `reported_by` - Email of reporter
- `reported_at` - Submission timestamp
- `resolved_at` - Resolution timestamp
- `attachments` - Comma-separated list of attachment filenames

### Contacts Table
- `id` - Primary key
- `name` - Contact name
- `email` - Contact email
- `message` - Message content
- `created_at` - Submission timestamp

## Project Structure

```
Campus360/
├── server.js          # Express server and API routes
├── package.json       # Dependencies and scripts
├── index.html         # Frontend application
├── .env              # Environment variables
├── .gitignore        # Git ignore rules
├── campus360.db      # SQLite database (created automatically)
└── uploads/          # File uploads directory (created automatically)
```

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Email domain validation (@drait.edu.in only)
- Role-based access control
- File upload validation

## Development

The application automatically creates the database and required tables on first run. The default admin user is also created automatically.

## License

ISC

## Authors

- Suravi RK (1da23is051@drait.edu.in)
- Vedhika V (1da23is056@drait.edu.in)



