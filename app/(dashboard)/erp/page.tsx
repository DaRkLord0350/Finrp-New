"use client"

import { useEffect, useState } from "react"
import Topbar from "@/components/Topbar"
import StatCard from "@/components/StatCard"
import RevenueChart from "@/components/RevenueChart"
import ItemTable from "@/components/ItemTable"
import { DollarSign, FileText, Users, Package } from "lucide-react"

interface BusinessProfile {
    organizationId: string
    industry: "Services" | "Retail & Trading" | "Manufacturing"
}

interface ERPData {
    revenue: number
    invoices: number
    customers: number
    items: number
    alerts: string[]
}

export default function ErpPage() {

    const [profile, setProfile] = useState<BusinessProfile | null>(null)
    const [data, setData] = useState<ERPData | null>(null)
    const [loading, setLoading] = useState(true)

    // ---------------- FETCH BUSINESS PROFILE ----------------

    useEffect(() => {
        fetch("/api/business-profile")
            .then(res => res.json())
            .then(profile => {
                setProfile(profile)

                if (profile?.organizationId) {
                    fetch(`/api/erp?organizationId=${profile.organizationId}`)
                        .then(res => res.json())
                        .then(setData)
                        .finally(() => setLoading(false))
                }
            })
    }, [])

    // ---------------- PROFILE NOT SET ----------------

    if (!profile) {
        return (
            <div className="p-8">
                <div className="bg-white dark:bg-slate-900 border rounded-xl p-10 text-center">
                    <h2 className="text-xl font-semibold">Set Up Your Business Profile</h2>
                    <p className="text-slate-500 mt-2">
                        To view your ERP dashboard you must configure your business.
                    </p>
                </div>
            </div>
        )
    }

    // ---------------- LOADING ----------------

    if (loading || !data) {
        return (
            <div className="p-8">
                <p className="text-slate-500">Loading ERP Dashboard...</p>
            </div>
        )
    }

    // ---------------- ERP DASHBOARD ----------------

    return (
        <div className="p-6 space-y-8">

            {/* HEADER */}

            {/* <Topbar /> */}

            {/* STATS */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <StatCard
                    title="Total Revenue"
                    value={`₹${(data?.revenue ?? 0).toLocaleString()}`}
                    icon={DollarSign}
                />

                <StatCard
                    title="Invoices"
                    value={(data?.invoices ?? 0).toString()}
                    icon={FileText}
                />

                <StatCard
                    title="Customers"
                    value={(data?.customers ?? 0).toString()}
                    icon={Users}
                />

                <StatCard
                    title="Items"
                    value={(data?.items ?? 0).toString()}
                    icon={Package}
                />

            </div>

            {/* ANALYTICS */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                <div className="bg-white dark:bg-slate-900 border rounded-xl p-">
                    <h3 className="text-lg font-semibold mb-4">Revenue Analytics</h3>
                    <RevenueChart />
                </div>

                <div className="bg-white dark:bg-slate-900 border rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Alerts</h3>

                    <div className="space-y-3">
                        {data.alerts.map((alert, i) => (
                            <div
                                key={i}
                                className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-3 rounded-lg text-sm"
                            >
                                {alert.message}
                            </div>
                        ))}
                    </div>

                </div>

            </div>

            {/* INVENTORY */}

            <div className="bg-white dark:bg-slate-900 border rounded-xl p-6">

                <h3 className="text-lg font-semibold mb-4">Inventory</h3>

                <ItemTable
                    items={[]}
                    onEdit={() => { }}
                    onDelete={() => { }}
                />

            </div>

        </div>
    )
}