'use client'

import { useState, useEffect } from 'react'
import { 
  Grid3X3, 
  List, 
  Table, 
  SortAsc, 
  SortDesc, 
  ChevronDown,
  Filter,
  Search
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type ViewMode = 'card' | 'list' | 'table'
export type SortField = 'title' | 'state' | 'createdAt' | 'fileSize' | 'processingStatus'
export type SortOrder = 'asc' | 'desc'

interface SortConfig {
  field: SortField
  order: SortOrder
}

interface ViewOptionsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortConfig: SortConfig
  onSortChange: (config: SortConfig) => void
  showFilters: boolean
  onToggleFilters: () => void
  searchTerm: string
  onSearchChange: (term: string) => void
  activeFilterCount: number
  totalDocuments: number
  filteredDocuments: number
}

const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: 'title', label: 'Title' },
  { field: 'state', label: 'State' },
  { field: 'createdAt', label: 'Date Created' },
  { field: 'fileSize', label: 'File Size' },
  { field: 'processingStatus', label: 'Status' }
]

export function DocumentViewOptions({
  viewMode,
  onViewModeChange,
  sortConfig,
  onSortChange,
  showFilters,
  onToggleFilters,
  searchTerm,
  onSearchChange,
  activeFilterCount,
  totalDocuments,
  filteredDocuments
}: ViewOptionsProps) {
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

  // Document library search tracking disabled - only track AI searches

  const handleSortChange = (field: SortField) => {
    if (sortConfig.field === field) {
      // Same field, toggle order
      onSortChange({
        field,
        order: sortConfig.order === 'asc' ? 'desc' : 'asc'
      })
    } else {
      // Different field, default to ascending
      onSortChange({
        field,
        order: 'asc'
      })
    }
    setSortDropdownOpen(false)
  }

  const currentSortOption = SORT_OPTIONS.find(opt => opt.field === sortConfig.field)
  const SortIcon = sortConfig.order === 'asc' ? SortAsc : SortDesc

  return (
    <Card>
      <CardContent className="p-4">
        {/* Top Row - Search and Quick Actions */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          {/* Filter Toggle */}
          <Button
            onClick={onToggleFilters}
            variant={activeFilterCount > 0 ? "default" : "outline"}
            className="inline-flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Bottom Row - View Options, Sort, and Stats */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left Side - View Options and Sort */}
          <div className="flex items-center space-x-4">
            {/* View Mode Selector */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                onClick={() => onViewModeChange('card')}
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                title="Card View"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => onViewModeChange('list')}
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                title="List View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => onViewModeChange('table')}
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                title="Table View"
              >
                <Table className="h-4 w-4" />
              </Button>
            </div>

            {/* Sort Dropdown */}
            <DropdownMenu open={sortDropdownOpen} onOpenChange={setSortDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="inline-flex items-center">
                  <SortIcon className="h-4 w-4 mr-2" />
                  Sort by {currentSortOption?.label}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {SORT_OPTIONS.map(option => (
                  <DropdownMenuItem
                    key={option.field}
                    onClick={() => handleSortChange(option.field)}
                    className="flex items-center"
                  >
                    {sortConfig.field === option.field && (
                      <SortIcon className="h-4 w-4 mr-2" />
                    )}
                    <span className={sortConfig.field === option.field ? '' : 'ml-6'}>
                      {option.label}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right Side - Document Stats */}
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>
              Showing {filteredDocuments.toLocaleString()} of {totalDocuments.toLocaleString()} documents
            </span>
            
            {filteredDocuments !== totalDocuments && (
              <Badge variant="outline">
                filtered
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      {/* Expanded Filters Message */}
      {showFilters && (
        <div className="px-4 pb-4">
          <div className="bg-muted border border-border rounded-lg p-3">
            <p className="text-sm text-foreground">
              Use the filters below to narrow down your document search. 
              {activeFilterCount > 0 && (
                <span className="font-medium"> {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active.</span>
              )}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

// Helper function to sort documents
export function sortDocuments<T extends {
  title: string
  state: string
  createdAt: string
  fileSize: number
  processingStatus: string
}>(documents: T[], sortConfig: SortConfig): T[] {
  return [...documents].sort((a, b) => {
    let aValue: any = a[sortConfig.field]
    let bValue: any = b[sortConfig.field]

    // Handle different data types
    if (sortConfig.field === 'createdAt') {
      aValue = new Date(aValue).getTime()
      bValue = new Date(bValue).getTime()
    } else if (sortConfig.field === 'fileSize') {
      aValue = Number(aValue)
      bValue = Number(bValue)
    } else if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) {
      return sortConfig.order === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.order === 'asc' ? 1 : -1
    }
    return 0
  })
}