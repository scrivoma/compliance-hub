# @ Mention Search System

This directory contains the implementation of the @ mention system for state selection in the Compliance Hub search interface.

## Components

### MentionInput.tsx
Main search input component that handles @ mentions for state selection.

**Features:**
- @ symbol triggers state dropdown
- Fuzzy search filtering by state name/code
- TAB completion for single matches
- Keyboard navigation (↑/↓ arrows)
- Inline state pills display
- Maintains backward compatibility with existing search

**Usage:**
```tsx
<MentionInput
  value={query}
  onChange={setQuery}
  onSubmit={handleMentionSearch}
  placeholder="Ask about compliance requirements... Use @state to filter by jurisdiction"
  disabled={loading}
/>
```

### StateDropdown.tsx
Dropdown component for state selection with filtering and keyboard navigation.

**Features:**
- Displays filtered states based on search
- Highlight matching text
- Keyboard navigation support
- Click to select states
- Auto-scroll to selected item

### StatePill.tsx
Pill components for displaying selected states.

**Components:**
- `StatePill` - Standard pill for state display
- `InlineStatePill` - Inline pill for mention input

## Utilities

### mention-parser.ts
Core parsing logic for @ mentions.

**Functions:**
- `parseQueryMentions()` - Extract @ mentions from query
- `getCurrentMention()` - Get current mention being typed
- `filterStates()` - Filter states based on search text
- `completeMention()` - Complete partial mention
- `findStateMatch()` - Find matching state from text

## Usage Examples

### Basic @ mention:
```
"What are the licensing requirements @colorado"
```

### Multiple states:
```
"Compare operator fees @california @nevada @newyork"
```

### Mixed with regular text:
```
"@colorado has different @nevada requirements than @texas"
```

## Integration

The @ mention system is integrated into the main search page (`/app/search/page.tsx`) and can be toggled on/off using the toggle button in the search interface.

### Backward Compatibility

The system maintains full backward compatibility with the existing state selection modal. Users can switch between:
- @ mention system (default)
- Legacy state selection modal

## State Management

- Selected states are automatically synced between @ mentions and the `selectedStates` array
- States are persisted in localStorage
- @ mentions are parsed and removed from the actual search query sent to the API
- The system handles edge cases like invalid states, duplicate mentions, etc.

## Keyboard Shortcuts

- `@` - Trigger state dropdown
- `↑/↓` - Navigate dropdown options
- `Tab` - Complete mention (when filtered to single state)
- `Enter` - Select state or submit search
- `Escape` - Cancel mention/close dropdown

## Styling

The components use Tailwind CSS classes and maintain consistency with the existing design system. State pills use different colors to distinguish between:
- Regular states (indigo)
- Special options like "ALL" (blue)
- Active states from @ mentions (green)