# MedGuardRx Documentation

This directory contains comprehensive documentation for the MedGuardRx OpenFDA application.

## Documentation Index

### Architecture & Design
- [Authentication State Management](./authentication-state-management.md) - Detailed guide on the optimized authentication caching system

### Performance Optimization
- **Authentication Optimization**: Persistent state management to reduce API calls
- **Query Caching**: Enhanced client-side query management (coming soon)
- **API Rate Limiting**: Protection against excessive API usage (coming soon)

### Development Guidelines
- Follow the authentication patterns documented in this directory
- Use the provided caching mechanisms for optimal performance
- Refer to component examples for proper implementation

### Future Documentation
- Query Cache Management System
- API Rate Limiting Implementation
- Component Usage Guidelines
- Database Schema Documentation
- Deployment and CI/CD Processes

## Quick Reference

### Authentication
```typescript
// Use cached auth state
const { isApproved, isAdmin, refreshAuthState } = useAuth()

// Force refresh when needed
await refreshAuthState()
```

### Protected Routes
```typescript
// Wrap components with guards
<AuthGuard>
  <YourComponent />
</AuthGuard>

<AdminGuard>
  <AdminComponent />
</AdminGuard>
```

For detailed implementation examples, see the specific documentation files in this directory.
