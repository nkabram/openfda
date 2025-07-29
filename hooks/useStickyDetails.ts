import { useEffect, useState, useRef, useCallback } from 'react'

interface UseStickyDetailsProps {
  isOpen: boolean
  contentRef: React.RefObject<HTMLDivElement>
}

export function useStickyDetails({ isOpen, contentRef }: UseStickyDetailsProps) {
  const [isSticky, setIsSticky] = useState(false)
  const [stickyTop, setStickyTop] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const originalPositionRef = useRef<number>(0)

  const updateStickyPosition = useCallback(() => {
    if (!contentRef.current || !buttonRef.current || !isOpen) {
      setIsSticky(false)
      return
    }

    const contentRect = contentRef.current.getBoundingClientRect()
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    
    // Store original position when first opening
    if (originalPositionRef.current === 0) {
      originalPositionRef.current = contentRect.bottom - 40 // Account for button height
    }

    // Check if content is scrolled past the top of viewport
    const contentTop = contentRect.top
    const contentBottom = contentRect.bottom
    
    // If the content top is above viewport and content bottom is still visible
    if (contentTop < 0 && contentBottom > 100) {
      setIsSticky(true)
      // Position button near top of viewport but not too high
      setStickyTop(Math.max(20, Math.min(viewportHeight - 100, 80)))
    }
    // If we're back to seeing the original position area
    else if (contentTop >= -50) {
      setIsSticky(false)
      originalPositionRef.current = 0
    }
    // If content is completely scrolled past
    else if (contentBottom < 50) {
      setIsSticky(false)
    }
  }, [isOpen, contentRef])

  useEffect(() => {
    if (!isOpen) {
      setIsSticky(false)
      originalPositionRef.current = 0
      return
    }

    const handleScroll = () => {
      requestAnimationFrame(updateStickyPosition)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    
    // Initial check
    updateStickyPosition()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen, updateStickyPosition])

  // Reset when closing
  useEffect(() => {
    if (!isOpen) {
      setIsSticky(false)
      originalPositionRef.current = 0
    }
  }, [isOpen])

  return {
    isSticky,
    stickyTop,
    buttonRef
  }
}
