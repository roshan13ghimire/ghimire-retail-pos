# Ghimire Retail POS

A full-stack point-of-sale and inventory management system developed for my family-owned retail store in Nepal.

The project is designed to simplify daily retail operations, manage inventory, and maintain accurate sales records.

## Live Demo

https://ghimire-retail-pos.onrender.com/

## Technology Stack

- Backend: Python, Django, Django REST Framework
- Frontend: React, JavaScript, Tailwind CSS
- Database: PostgreSQL
- Deployment: Docker, Gunicorn, Render
- Version Control: Git and GitHub

## Key Features

- Product and inventory management
- Sales processing and receipt generation
- Refund and return management
- Role-based access control
- Stock movement tracking
- Low-stock alerts
- Sales history and daily reporting
- Dashboard for business performance

## Engineering Highlights

- REST APIs for business operations
- Relational database design using PostgreSQL
- Atomic database transactions for sales processing
- Database locking to maintain inventory consistency
- Duplicate transaction prevention
- Authentication and role-based permissions
- Automated tests for permissions and sales operations
- Multi-stage Docker build for deployment

## Architecture

React Frontend
    |
Django REST API
    |
PostgreSQL Database

The application separates user interface components,
business logic, and database operations to improve
maintainability.

## Project Objective

This project was developed to solve a practical business
problem rather than simply demonstrate a technology stack.

I plan to use the application in my family's retail store
and continue improving its reliability, usability, and
operational features.

## Author

Roshan Ghimire

Portfolio: https://www.roshanghimiree.com.np/
