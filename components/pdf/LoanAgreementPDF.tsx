// Server-only component — only imported by lib/pdf/generateLoanAgreementPdf.ts
// Do NOT import this in any client component or page.

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface LoanAgreementPDFData {
  lenderName: string;
  applicationNumber: string;
  customerName: string;
  productName: string;
  approvedAmount: string;
  approvedTenureMonths: number;
  interestRateOffered: string;
  version: number;
  signatories: { role: string; name: string; status: string }[];
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 24, borderBottom: "2px solid #1a1a1a", paddingBottom: 12 },
  lenderName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginTop: 16 },
  heading: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  table: { marginTop: 8, border: "1px solid #cccccc" },
  row: { flexDirection: "row", borderBottom: "1px solid #eeeeee" },
  rowLast: { flexDirection: "row" },
  cellLabel: { width: "50%", padding: 6, backgroundColor: "#f7f7f7", fontFamily: "Helvetica-Bold" },
  cellValue: { width: "50%", padding: 6 },
  signRow: { flexDirection: "row", borderBottom: "1px solid #eeeeee", padding: 6 },
  signCol: { width: "33%" },
  footer: { marginTop: 32, fontSize: 8, color: "#888888", borderTop: "1px solid #eeeeee", paddingTop: 8 },
});

export function LoanAgreementPDF({ data }: { data: LoanAgreementPDFData }) {
  const rows: [string, string][] = [
    ["Application Number", data.applicationNumber],
    ["Loan Product", data.productName],
    ["Principal Amount", `₹${data.approvedAmount}`],
    ["Tenure", `${data.approvedTenureMonths} months`],
    ["Interest Rate", `${data.interestRateOffered}% p.a. (reducing balance unless stated otherwise)`],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.lenderName}>{data.lenderName}</Text>
          <Text style={styles.title}>Loan Agreement</Text>
          <Text style={styles.meta}>Application {data.applicationNumber} · Version {data.version}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            This Loan Agreement (“Agreement”) is entered into between {data.lenderName} (“Lender”) and {data.customerName}
            {" "}(“Borrower”) governing the loan facility described below.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>1. Facility Terms</Text>
          <View style={styles.table}>
            {rows.map(([label, value], i) => (
              <View key={label} style={i === rows.length - 1 ? styles.rowLast : styles.row}>
                <Text style={styles.cellLabel}>{label}</Text>
                <Text style={styles.cellValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>2. Repayment</Text>
          <Text style={styles.paragraph}>
            The Borrower shall repay the facility via the EMI schedule issued upon disbursement, by auto-debit
            (NACH / UPI AutoPay) where a mandate is registered, or by other approved payment methods. Late payment,
            foreclosure, and part-payment charges are as specified in the loan product terms.
          </Text>
          <Text style={styles.heading}>3. Default</Text>
          <Text style={styles.paragraph}>
            Failure to pay any installment when due may result in penalty charges, reporting to credit bureaus, and
            recovery action in accordance with applicable law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Signatories</Text>
          <View style={styles.table}>
            {data.signatories.map((s, i) => (
              <View key={`${s.role}-${i}`} style={i === data.signatories.length - 1 ? styles.rowLast : styles.row}>
                <Text style={styles.cellLabel}>{s.role}</Text>
                <Text style={styles.cellValue}>{s.name} — {s.status}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>This document is executed electronically. Signature status for each party is recorded above and tracked via the platform&apos;s e-sign workflow.</Text>
        </View>
      </Page>
    </Document>
  );
}
