"use client"

import { useState, useCallback } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AlertDialogOptions {
  title?: string
  description: string
  actionLabel?: string
  variant?: "default" | "destructive"
}

export function useAlertDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<AlertDialogOptions>({
    description: "",
  })

  const showAlert = useCallback(
    (opts: AlertDialogOptions): Promise<void> => {
      return new Promise((resolve) => {
        setOptions(opts)
        setIsOpen(true)

        // Store resolve function to call when dialog closes
        const handleClose = () => {
          setIsOpen(false)
          resolve()
        }

        // Attach close handler to window temporarily
        ;(window as any).__alertDialogResolve = handleClose
      })
    },
    []
  )

  const handleAction = () => {
    if ((window as any).__alertDialogResolve) {
      ;(window as any).__alertDialogResolve()
      delete (window as any).__alertDialogResolve
    }
    setIsOpen(false)
  }

  const AlertDialogComponent = (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {options.title && <AlertDialogTitle>{options.title}</AlertDialogTitle>}
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleAction}
            className={
              options.variant === "destructive"
                ? "bg-red-600 hover:bg-red-700"
                : ""
            }
          >
            {options.actionLabel || "OK"}
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
