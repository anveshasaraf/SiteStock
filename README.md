# 🏗️ Construction Materials Inventory Management System

Inventory management was a major challenge for an EPC construction company operating across 20+ active sites and managing over $29M in materials. Existing processes relied on spreadsheets and manual logs, which often led to discrepancies during reconciliation and slowed down decision-making. A previous digital attempt failed because the system was unintuitive and hard to sustain for on-site staff, many of whom had limited technical training and needed something simple, reliable, and mobile-friendly.

To design a solution that would actually be adopted, I started by understanding the day-to-day workflow of site engineers and storekeepers—how shipments were logged, where errors crept in, and why the old system broke down. This discovery process revealed that the real bottleneck wasn’t just the technology, but its fit with the realities of on-site work.

With those insights, I built SiteStock, **focusing on three principles**:

**Usability first** → a mobile-first, intuitive UI designed for quick updates in the field, with minimal training required.

**Trust through transparency** → role-based access, real-time sync, and auditable logs gave managers confidence without overburdening staff.

**Scalable engineering** → a Supabase backend with granular permissions, secure authentication, and optimized data flows to support multi-site operations.

I also iterated with feedback loops, demoing early prototypes to site staff and refining features to remove friction. By treating adoption as a core engineering goal, not an afterthought, SiteStock became a tool people wanted to use.

Since launch, the platform has cut inventory errors and reconciliation time by 35%, while giving leadership real-time visibility into inventory movements and discrepancies across all sites. It has successfully flagged discrepancies in shipments, helping the company reduce losses and enforce accountability.

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

![1](https://github.com/user-attachments/assets/4f29309f-52bd-4362-9c16-e2d78e751371)
_Inventory Management for a Site_

![2](https://github.com/user-attachments/assets/921e7153-e0dc-46c4-a790-e4a8896a8ec4)
_Current Inventory for Steel in a Site_

![3](https://github.com/user-attachments/assets/fa0f3786-f7a3-4bc6-b98f-e0536bd7c246)
_Stock Summary for Steel in a Site_

![4](https://github.com/user-attachments/assets/36854b5b-0820-4bfe-a82b-55a21f0227de)
_Adding an Incoming Shipment of Steel for a Site_

![5](https://github.com/user-attachments/assets/6b458c76-5f7f-4073-b980-063fa5125b48)
_Logging an Outgoing Shipment of Steel for a Site_

![6](https://github.com/user-attachments/assets/7ffadcda-9dba-4a92-8f71-61540c4eb88e)
_Transaction History for all Shipments of Steel for a Site_

![7](https://github.com/user-attachments/assets/1e0d19cd-2a87-4bb1-80ab-99465e081947)
_Managing/ Editing a Site Details (Exclusively Available to the Super Admin)_

![Site Name](https://github.com/user-attachments/assets/f5122728-f5fc-4fbd-b265-5a3eb9b406dc)
_Admin Panel to Control User Permission Levels/ Site Access_

Note: This repository intentionally excludes database credentials, company-specific data, production configurations and proprietary information.

### What's Missing for Full Deployment:
1. Supabase project setup and configuration
2. Database schema creation and RLS policies
3. Environment variables configuration
4. User authentication setup
5. Production build deployment

### What this repository includes:
The codebase showcases:
- ✅ Complete React application architecture
- ✅ Modern development practices
- ✅ Responsive design implementation
- ✅ State management patterns
- ✅ Component organization
- ✅ Error handling and loading states
