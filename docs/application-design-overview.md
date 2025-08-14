# Compliance Hub - Application Design Documentation

## Executive Summary

### Purpose & Business Context

The **Compliance Hub** is a specialized AI-powered document management system designed specifically for sports betting and online gaming regulatory compliance. The application addresses the complex challenge of managing, searching, and analyzing regulatory documents across multiple jurisdictions (US states) in the rapidly evolving sports betting industry.

### Key Business Drivers

- **Regulatory Complexity**: Sports betting regulations vary significantly across states, requiring specialized knowledge and quick access to jurisdiction-specific information
- **Compliance Risk**: Organizations need immediate access to accurate regulatory information to ensure compliance and avoid penalties
- **Efficiency**: Manual document searches and cross-referencing across multiple state regulations is time-consuming and error-prone
- **Accuracy**: AI-powered search with precise citations ensures regulatory information is accurate and traceable

### Target Users

1. **Standard Users (USER Role)**:
   - **Compliance Officers**: Primary users who need quick access to regulatory information
   - **Legal Teams**: Users who require detailed citations and source verification
   - **Business Analysts**: Users who need to understand regulatory differences across jurisdictions
   - **Access**: Document viewing, AI search, dashboard - no administrative capabilities

2. **Administrators (ADMIN Role)**:
   - **System Administrators**: Users who manage document collections and system settings
   - **Document Managers**: Users responsible for uploading and organizing regulatory documents
   - **User Managers**: Users who create and manage user accounts and permissions
   - **Access**: Full system access including document administration and user management

### Core Value Proposition

The Compliance Hub transforms regulatory research from a manual, time-intensive process into an intelligent, citation-backed search experience that provides:

- **Instant Access**: AI-powered search across all regulatory documents with voice interaction capabilities
- **Jurisdictional Intelligence**: Multi-state filtering and comparison capabilities with state-aware tracking
- **Citation Tracking**: Every piece of information is linked to source documents with precise citations
- **Real-time Updates**: Streaming search responses with live processing feedback
- **Comprehensive Coverage**: Support for multiple document types (rules, regulations, guidance, forms)
- **Personalized Experience**: Comprehensive dashboard with activity tracking, recent documents, and bookmarks
- **Voice Interaction**: Native ElevenLabs voice assistant for hands-free regulatory research
- **Smart Navigation**: Authentication-based routing with immediate access to relevant information

## Application Overview

### High-Level Functionality

The Compliance Hub provides six core functional areas:

1. **Intelligent Search**: AI-powered search with natural language queries, real-time streaming responses, and precise citations
2. **Document Management**: Upload, categorization, and organization of regulatory documents with metadata
3. **Citation System**: Advanced citation tracking that links search results to specific document sections
4. **Multi-Jurisdictional Support**: State-specific filtering and comparison tools
5. **Voice Assistant Integration**: Native ElevenLabs ConvAI widget for hands-free regulatory research
6. **Comprehensive Dashboard**: Real-time activity tracking, personalized experience, and quick access to recent work

### Key Features

#### 🔍 AI-Powered Search
- Natural language query processing
- Real-time streaming responses
- Multi-LLM support (Anthropic, OpenAI, Google)
- Contextual follow-up questions
- Citation linking with source verification
- Search history tracking with state information
- Re-runnable searches with preserved state selections

#### 📄 Document Processing
- PDF upload and text extraction
- Automated chunking and embedding generation
- Vector storage for similarity search
- Progress tracking and status monitoring
- Error handling and retry mechanisms
- Automatic document view tracking
- Recently added document monitoring

#### 🏛️ Multi-Jurisdictional Intelligence
- State-specific document filtering
- Cross-jurisdictional comparison
- Favorites and recent states tracking
- Jurisdiction-aware search results
- State-aware activity tracking and search history

#### 📊 Citation Management
- Precise document section linking
- Click-through to source documents
- Multi-citation support (e.g., [1, 4, 5])
- Citation highlighting and navigation

#### 👥 User Management
- Role-based access control (ADMIN/USER roles)
- Admin-only user creation and management
- Session management with NextAuth
- Organization-based user grouping
- Comprehensive user activity tracking
- Dynamic navigation based on user permissions

#### 🎙️ Voice Assistant Integration
- Native ElevenLabs ConvAI widget integration
- Authentication-based voice access
- Seamless voice interaction capabilities
- Dynamic script loading and initialization
- CSP-compliant security configuration

#### 📊 Comprehensive Dashboard System
- Authentication-based home page routing
- Real-time user activity tracking
- Recent documents and search history
- Persistent bookmark management
- Newly added document notifications
- Quick actions and compliance overview
- State-specific mini-dashboards

#### 🔄 Activity Tracking System
- Document view tracking with metadata
- Search history with state information
- Bookmark management with persistence
- Recently added document monitoring
- File-based storage for development
- Real-time dashboard updates

### Technical Architecture Summary

The application follows a modern full-stack architecture:

- **Frontend**: React 19 with Next.js 15, TypeScript, and TailwindCSS
- **Backend**: Next.js API routes with serverless functions
- **Database**: SQLite with Prisma ORM for structured data
- **Vector Storage**: ChromaDB for document embeddings and similarity search
- **AI/ML**: Integration with multiple LLM providers for natural language processing
- **Authentication**: NextAuth with JWT sessions and credential-based login

### Security & Access Control

The application implements comprehensive security measures:

#### **Role-Based Access Control**
- **Two-tier permission system**: USER and ADMIN roles
- **Dynamic UI**: Navigation and features adapt based on user role
- **URL Protection**: Direct URL access blocked with proper error messages
- **API Security**: All admin endpoints require ADMIN role verification

#### **User Experience by Role**
- **Standard Users**: Clean, focused interface with document viewing and search capabilities
- **Administrators**: Full-featured interface with "Doc Admin" and "Settings" sections
- **Visual Indicators**: Admin badge and shield icons for clear role identification

#### **Access Boundaries**
- **Documents**: Read-only access for all users, upload restricted to admins
- **User Management**: Admin-exclusive with self-deletion protection
- **System Settings**: Admin-only RAG configuration and system preferences
- **Navigation**: Role-appropriate menu items with no unnecessary clutter

### Deployment & Scaling

The application is designed for:
- **Development**: Local development with SQLite and ChromaDB
- **Production**: Scalable deployment with external database and vector storage
- **Performance**: Optimized for fast search responses with streaming capabilities
- **Security**: Enterprise-grade authentication and authorization patterns

## Success Metrics

The application's success is measured by:

1. **Search Accuracy**: Relevance and precision of search results
2. **Response Time**: Speed of search query processing and streaming
3. **User Adoption**: Active users and search query volume
4. **Citation Quality**: Accuracy and usefulness of citation links
5. **Compliance Impact**: Reduction in compliance research time and improved accuracy

## Future Enhancements

Planned improvements include:
- Advanced document comparison tools
- Regulatory change tracking and notifications
- Integration with external legal databases
- Mobile application support
- Advanced analytics and reporting
- Multi-language support for international regulations
- Enhanced voice assistant capabilities with custom training
- Advanced dashboard analytics and reporting
- Integration with external calendar systems for deadline tracking
- Enhanced bookmark organization and tagging system

---

*This document serves as the foundation for understanding the Compliance Hub application. For detailed technical specifications, please refer to the additional documentation sections.*