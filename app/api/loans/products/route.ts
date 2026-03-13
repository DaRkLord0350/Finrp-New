import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";

// Mock loan products database - in production, this would come from a database or external API
const LOAN_PRODUCTS = [
  {
    id: "sbi-wc-001",
    name: "SBI Working Capital Loan",
    bank: "State Bank of India",
    tag: "Recommended",
    interestRateMin: 9.25,
    interestRateMax: 11.5,
    maxAmount: 10000000, // ₹1 Crore
    processingFee: 0.5,
  },
  {
    id: "hdfc-eq-001",
    name: "HDFC Equipment Loan",
    bank: "HDFC Bank",
    tag: "Popular",
    interestRateMin: 8.75,
    interestRateMax: 10.25,
    maxAmount: 5000000, // ₹50 Lakhs
    processingFee: 1.0,
  },
  {
    id: "icici-msme-001",
    name: "ICICI MSME Loan",
    bank: "ICICI Bank",
    tag: "Fast Approval",
    interestRateMin: 10.5,
    interestRateMax: 12.0,
    maxAmount: 7500000, // ₹75 Lakhs
    processingFee: 0.75,
  },
  {
    id: "axis-bl-001",
    name: "Axis Bank Business Loan",
    bank: "Axis Bank",
    tag: "Competitive",
    interestRateMin: 9.0,
    interestRateMax: 11.75,
    maxAmount: 5000000,
    processingFee: 1.25,
  },
  {
    id: "kotak-tl-001",
    name: "Kotak Trade Loan",
    bank: "Kotak Mahindra Bank",
    tag: "Flexible",
    interestRateMin: 11.0,
    interestRateMax: 13.5,
    maxAmount: 3000000,
    processingFee: 0.6,
  },
];

export async function GET(req: NextRequest) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return recommended products
    // In production, you could filter based on user's business profile
    return NextResponse.json(LOAN_PRODUCTS);
  } catch (error) {
    console.error("Error fetching loan products:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan products" },
      { status: 500 }
    );
  }
}
