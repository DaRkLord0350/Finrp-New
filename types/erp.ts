export interface ERPData {
  revenue: number
  profitMargin: number
  cashFlow: number
  workingCapital: number
  activeProjects: {
    id: string
    title: string
    status: string
    amount: number
  }[]
}
