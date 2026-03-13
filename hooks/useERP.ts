import { useEffect, useState } from "react"
import { ERPData } from "@/types/erp"

export function useERP() {

  const [data, setData] = useState<ERPData | null>(null)

  useEffect(() => {
    fetch("/api/erp")
      .then(res => res.json())
      .then(setData)
  }, [])

  return data
}