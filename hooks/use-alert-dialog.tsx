"use client"

import { useState, useCallback, useRef } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AlertDialogOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
  variant?: "default" | "destructive"
}

export function useAlertDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<AlertDialogOptions>({
    description: "",
  })
  const resolveRef = useRef<(() => void) | null>(null)

  const closeDialog = useCallback(() => {
    const resolver = resolveRef.current
    resolveRef.current = null
    setIsOpen(false)
    resolver?.()
  }, [])

  const handleConfirm = useCallback(async () => {
    try {
      await options.onConfirm?.()
    } finally {
      closeDialog()
    }
  }, [options.onConfirm, closeDialog])

  const handleCancel = useCallback(async () => {
    try {
      await options.onCancel?.()
    } finally {
      closeDialog()
    }
  }, [options.onCancel, closeDialog])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open && resolveRef.current) {
        const resolver = resolveRef.current
        resolveRef.current = null
        resolver()
      }
    },
    []
  )

  const showAlert = useCallback((opts: AlertDialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setIsOpen(true)
    })
  }, [])

  const AlertDialogComponent = (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {options.title && <AlertDialogTitle>{options.title}</AlertDialogTitle>}
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {options.cancelLabel && (
            <AlertDialogCancel onClick={handleCancel}>{options.cancelLabel}</AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            className={options.variant === "destructive" ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {options.confirmLabel || "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return {
    showAlert,
    AlertDialogComponent,
  }
}
