# ShadCN/UI Components Documentation

## Overview

The Compliance Hub uses ShadCN/UI components to provide a premium, accessible, and consistent user interface. This documentation covers the implementation, customization, and usage patterns of ShadCN components throughout the application.

## Installation & Setup

### Core Components Installed

```bash
npx shadcn@latest add card button badge alert tabs table skeleton input select
```

### Component Structure

```
/components/ui/
├── alert.tsx          # Alert component with variants
├── badge.tsx          # Badge component for labels and counts
├── button.tsx         # Button component with variants
├── card.tsx           # Card component with header/content
├── input.tsx          # Input component with variants
├── select.tsx         # Select dropdown component
├── skeleton.tsx       # Loading skeleton component
├── table.tsx          # Table component with headers/rows
└── tabs.tsx           # Tabs component for navigation
```

## Component Usage Patterns

### 1. Card Component

The Card component is the foundation of the dashboard design, providing consistent containers with hover effects.

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Dashboard status cards
<Card className="transition-all duration-200 hover:shadow-md hover:scale-105">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Health Score</p>
        <div className="flex items-center space-x-2">
          <span className="text-3xl font-bold text-green-600">94%</span>
          <Badge variant="default">Excellent</Badge>
        </div>
      </div>
      <div className="p-3 rounded-full bg-green-50">
        <Shield className="h-6 w-6 text-green-600" />
      </div>
    </div>
  </CardContent>
</Card>
```

**Key Features:**
- Hover effects with `hover:shadow-md hover:scale-105`
- Consistent padding and spacing
- Flexible content structure
- Responsive design

### 2. Badge Component

Badges provide visual indicators for status, counts, and categories.

```typescript
import { Badge } from '@/components/ui/badge'

// Status badges with variants
<Badge variant="default">Excellent</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Action Required</Badge>
<Badge variant="outline">NY</Badge>

// Animated badges
<Badge variant="destructive" className="animate-pulse">
  Action Required
</Badge>
```

**Variants:**
- `default`: Blue background for positive states
- `secondary`: Gray background for neutral states
- `destructive`: Red background for urgent/error states
- `outline`: Transparent background with border

### 3. Button Component

Enhanced buttons with hover effects and group interactions.

```typescript
import { Button } from '@/components/ui/button'

// Primary action buttons
<Button
  asChild
  variant="outline"
  size="lg"
  className="h-auto p-4 justify-start group transition-all duration-200 hover:shadow-md hover:scale-105 border-gray-200 hover:border-indigo-200 bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50"
>
  <Link href="/search" className="flex items-center space-x-4">
    <div className="p-2 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
      <Search className="h-6 w-6 text-indigo-600" />
    </div>
    <div className="text-left">
      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
        AI Search
      </h3>
      <p className="text-sm text-muted-foreground">Natural language search</p>
    </div>
  </Link>
</Button>
```

**Enhanced Features:**
- Gradient backgrounds on hover
- Group hover effects for icons and text
- Micro-animations (`hover:scale-105`)
- Consistent color transitions

### 4. Alert Component

Professional alerts for important notifications.

```typescript
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

// Urgent compliance alerts
<Alert className="mt-6 border-red-200 bg-red-50">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle className="text-red-800">
    Urgent: Michigan License Renewal
  </AlertTitle>
  <AlertDescription className="flex items-center justify-between">
    <span className="text-red-700">Deadline in 3 days</span>
    <Button 
      variant="destructive" 
      size="sm" 
      className="ml-4 animate-pulse hover:animate-none"
    >
      Review Now
    </Button>
  </AlertDescription>
</Alert>
```

**Customization:**
- Custom border and background colors
- Animated buttons within alerts
- Flexible layout with actions
- Icon integration

### 5. Tabs Component

Tabbed interface for organized content navigation.

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Recent Activity Hub tabs
<Tabs defaultValue="documents" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="documents" className="flex items-center space-x-2">
      <FileText className="h-4 w-4" />
      <span>Documents</span>
      {recentDocuments.length > 0 && (
        <Badge variant="secondary" className="ml-1">
          {recentDocuments.length}
        </Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="searches" className="flex items-center space-x-2">
      <Search className="h-4 w-4" />
      <span>Searches</span>
      {recentSearches.length > 0 && (
        <Badge variant="secondary" className="ml-1">
          {recentSearches.length}
        </Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="bookmarks" className="flex items-center space-x-2">
      <Star className="h-4 w-4" />
      <span>Bookmarks</span>
      {bookmarks.length > 0 && (
        <Badge variant="secondary" className="ml-1">
          {bookmarks.length}
        </Badge>
      )}
    </TabsTrigger>
  </TabsList>

  <TabsContent value="documents" className="mt-6">
    {/* Document content */}
  </TabsContent>
  
  <TabsContent value="searches" className="mt-6">
    {/* Search content */}
  </TabsContent>
  
  <TabsContent value="bookmarks" className="mt-6">
    {/* Bookmark content */}
  </TabsContent>
</Tabs>
```

**Features:**
- Grid-based tab layout
- Icon and badge integration
- Conditional badge display
- Smooth transitions

### 6. Skeleton Component

Loading states for async content.

```typescript
import { Skeleton } from '@/components/ui/skeleton'

// Dashboard loading states
if (loading) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-1">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Usage Patterns:**
- Mimic the actual content structure
- Consistent spacing and sizing
- Proper loading state feedback

## Design System Patterns

### Color Scheme

```typescript
// State-based color coding
const stateColors = {
  success: 'text-green-600 bg-green-50',
  warning: 'text-yellow-600 bg-yellow-50',
  error: 'text-red-600 bg-red-50',
  info: 'text-blue-600 bg-blue-50'
}

// Hover state colors
const hoverColors = {
  indigo: 'hover:from-indigo-50 hover:to-blue-50',
  green: 'hover:from-green-50 hover:to-emerald-50',
  yellow: 'hover:from-yellow-50 hover:to-orange-50'
}
```

### Animation Patterns

```css
/* Consistent hover effects */
.card-hover {
  @apply transition-all duration-200 hover:shadow-md hover:scale-105;
}

/* Button group interactions */
.button-group-hover {
  @apply group transition-all duration-200 hover:shadow-md hover:scale-105;
}

/* Icon container transitions */
.icon-container {
  @apply transition-colors duration-200;
}

/* Animated badges */
.badge-pulse {
  @apply animate-pulse hover:animate-none;
}
```

### Layout Patterns

```typescript
// Consistent card layouts
const cardLayout = "transition-all duration-200 hover:shadow-md hover:scale-105"

// Gradient backgrounds
const gradientBg = "bg-gradient-to-br from-white to-gray-50"

// Icon containers
const iconContainer = "p-2 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors"

// Consistent spacing
const spacing = "space-y-6" // For sections
const itemSpacing = "space-y-3" // For items
```

## Advanced Customization

### Theme Configuration

```typescript
// tailwind.config.js customization
module.exports = {
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-hover': 'scale 0.2s ease-in-out'
      },
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb'
        }
      }
    }
  }
}
```

### Custom Component Variants

```typescript
// Custom badge variants
const badgeVariants = {
  status: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
  count: 'inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium',
  state: 'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium'
}
```

## Performance Optimizations

### Lazy Loading

```typescript
// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// Use with Suspense
<Suspense fallback={<Skeleton className="h-64 w-full" />}>
  <HeavyComponent />
</Suspense>
```

### Memoization

```typescript
// Memoize expensive card renders
const MemoizedCard = memo(({ data }) => (
  <Card className="transition-all duration-200 hover:shadow-md hover:scale-105">
    <CardContent>
      {/* Content */}
    </CardContent>
  </Card>
))
```

## Best Practices

### 1. Consistent Hover Effects
- Always use `transition-all duration-200` for smooth animations
- Combine `hover:shadow-md hover:scale-105` for consistent lift effects
- Use `group` and `group-hover:` for coordinated interactions

### 2. Color Consistency
- Use semantic color classes (`text-green-600`, `bg-green-50`)
- Maintain consistent color relationships across components
- Use the same color palette for similar UI elements

### 3. Responsive Design
- Test all components on mobile, tablet, and desktop
- Use responsive classes (`sm:`, `md:`, `lg:`)
- Ensure touch targets are appropriately sized

### 4. Accessibility
- All ShadCN components include ARIA attributes
- Maintain proper contrast ratios
- Test with keyboard navigation
- Use semantic HTML elements

### 5. Performance
- Use `memo()` for expensive components
- Implement proper loading states with Skeleton
- Lazy load heavy components when appropriate

## Component Inventory

### Dashboard Components
- **ComplianceStatusOverview**: Card grid with hover effects and badges
- **RecentActivityHub**: Tabbed interface with skeleton loading
- **QuickActionsCenter**: Gradient backgrounds with group hover effects

### Common Patterns
- **Status Cards**: Card + Badge + Icon container
- **Interactive Lists**: Card + Button + Hover animations
- **Loading States**: Skeleton components matching content structure
- **Navigation**: Tabs with icons and badges

---

*This documentation provides comprehensive coverage of ShadCN/UI implementation in the Compliance Hub. All components follow consistent patterns for maintainability and user experience.*