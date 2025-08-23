# 🏗️ Construction Materials Inventory Management System

A comprehensive web application for managing construction materials inventory across multiple sites. Built for construction companies to track steel, cement, stone chips, sand, and diesel inventory with role-based access control.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Usage](#-usage)
- [User Roles & Permissions](#-user-roles--permissions)
- [Database Schema](#-database-schema)
- [Screenshots](#-screenshots)
- [Why Database Connection is Not Included](#-why-database-connection-is-not-included)
- [Contributing](#-contributing)

## ✨ Features

### 🎯 Core Functionality
- **Multi-Material Inventory Management**: Track Steel, Cement, Stone Chips, Sand, and Diesel
- **Site-Based Organization**: Manage inventory across multiple construction sites
- **Role-Based Access Control**: Admin, Super Admin, and Site-specific user permissions
- **Real-time Inventory Tracking**: Live updates of stock levels and transactions
- **Mobile-Responsive Design**: Full functionality on desktop and mobile devices
- **User Authentication**: Secure login system with profile management

### 📊 Inventory Features
- Add/Remove inventory transactions
- Track stock levels with automatic calculations
- Historical transaction records
- Site-specific inventory isolation
- Material-specific units and measurements

### 👥 User Management
- User profile management
- Site access permissions
- Admin panel for user and site management
- Authentication with secure sessions

### 🎨 UI/UX
- Modern, clean interface built with React
- Mobile-first responsive design
- Intuitive navigation with breadcrumbs
- Real-time loading states and error handling

## 🛠️ Tech Stack

### Frontend
- **React 19.1.0** - Modern UI library with hooks
- **Vite 6.3.5** - Fast build tool and dev server
- **Lucide React** - Beautiful icon library
- **CSS3** - Custom styling with responsive design

### Backend & Database
- **Supabase** - PostgreSQL database with built-in authentication
- **Row Level Security (RLS)** - Database-level access control
- **Real-time subscriptions** - Live data updates

### Development Tools
- **ESLint** - Code linting and formatting
- **Vite Dev Server** - Hot module replacement for development

## 📁 Project Structure

```
steel-inventory/
├── src/
│   ├── App.jsx                    # Main application component
│   ├── AuthSystem.jsx             # Authentication system
│   ├── AdminPanel.jsx             # Admin management interface
│   ├── Sites.jsx                  # Site management component
│   ├── Steel.jsx                  # Steel inventory management
│   ├── Cement.jsx                 # Cement inventory management
│   ├── StoneChips.jsx            # Stone chips inventory management
│   ├── Sand.jsx                   # Sand inventory management
│   ├── Diesel.jsx                # Diesel inventory management
│   ├── MobileNav.jsx             # Mobile navigation component
│   ├── CustomMaterialsManager.jsx # Custom materials handler
│   ├── supabaseClient.js         # Database connection (configured separately)
│   ├── main.jsx                  # Application entry point
│   └── index.css                 # Global styles
├── public/                        # Static assets
├── package.json                   # Dependencies and scripts
├── vite.config.js                # Vite configuration
└── eslint.config.js              # ESLint configuration
```

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager
- Supabase account (for database setup)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/steel-inventory.git
   cd steel-inventory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 🌍 Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: The actual database credentials are not included in this repository for security reasons. You'll need to set up your own Supabase project and configure the environment variables.

## 🎮 Usage

### For Site Users
1. **Login**: Use your credentials to access the system
2. **Select Site**: Choose from your assigned construction sites
3. **Manage Inventory**: 
   - View current stock levels
   - Add new materials to inventory
   - Record material usage/removal
   - View transaction history

### For Administrators
1. **User Management**: Create and manage user accounts
2. **Site Management**: Set up new construction sites
3. **Access Control**: Assign users to specific sites
4. **System Overview**: Monitor inventory across all sites

## 👥 User Roles & Permissions

### 🏢 Super Admin
- Full system access
- Manage all users and sites
- System configuration
- Global inventory overview

### 🔧 Admin
- Site and user management
- Access to multiple sites
- User permission assignment
- Site-level reporting

### 👷 Site User
- Access to assigned sites only
- Inventory management for permitted sites
- Transaction recording
- Basic reporting

## 🗄️ Database Schema

The application uses the following main database tables:

### Core Tables
- `user_profiles` - User information and roles
- `sites` - Construction site details
- `user_site_access` - Site access permissions

### Inventory Tables
- `steel_inventory` - Steel stock and transactions
- `cement_inventory` - Cement stock and transactions
- `stone_chips_inventory` - Stone chips stock and transactions
- `sand_inventory` - Sand stock and transactions
- `diesel_inventory` - Diesel stock and transactions

### Features
- Row Level Security (RLS) for data protection
- Real-time subscriptions for live updates
- Automated timestamp tracking
- Foreign key relationships for data integrity

## 📸 Screenshots

*Screenshots can be added here to showcase the application interface*

<!-- Add screenshots of:
- Login page
- Dashboard/Site selection
- Inventory management interface
- Mobile responsive design
- Admin panel
-->

## 🔒 Why Database Connection is Not Included

This repository is prepared for recruitment/portfolio purposes and **intentionally excludes**:

- **Database credentials** - Supabase URL and API keys removed for security
- **Company-specific data** - No real inventory or user data
- **Production configurations** - Environment variables not included
- **Proprietary information** - Company details anonymized

### What's Missing for Full Deployment:
1. Supabase project setup and configuration
2. Database schema creation and RLS policies
3. Environment variables configuration
4. User authentication setup
5. Production build deployment

### For Demonstration:
The codebase showcases:
- ✅ Complete React application architecture
- ✅ Modern development practices
- ✅ Responsive design implementation
- ✅ State management patterns
- ✅ Component organization
- ✅ Error handling and loading states

## 🤝 Contributing

This project demonstrates professional development practices including:

- **Clean Code Architecture**: Modular components and clear separation of concerns
- **Modern React Patterns**: Hooks, context, and functional components
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Security Best Practices**: Environment variable management and secure authentication
- **Code Quality**: ESLint configuration and consistent formatting

## 📄 License

This project is for demonstration purposes. Please contact the author for usage permissions.

## 👨‍💻 Developer

**Anvesha** - Full Stack Developer
- Built comprehensive inventory management system
- Implemented role-based access control
- Created responsive, mobile-friendly interface
- Integrated real-time database functionality

---

*This project demonstrates expertise in React, modern JavaScript, database design, user authentication, responsive design, and full-stack application development.*
