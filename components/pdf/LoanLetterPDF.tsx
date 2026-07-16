// Server-only component — only imported by lib/pdf/generateLoanLetterPdf.ts
// Do NOT import this in any client component or page.

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface LoanLetterPDFData {
  letterTitle: string; // "Sanction Letter" | "Offer Letter"
  lenderName: string;
  applicationNumber: string;
  customerName: string;
  productName: string;
  approvedAmount: string;
  approvedTenureMonths: number;
  interestRateOffered: string;
  emiAmount: string;
  processingFee: string;
  issuedAt: string;
  version: number;
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 24, borderBottom: "2px solid #1a1a1a", paddingBottom: 12 },
  lenderName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8 },
  meta: { fontSize: 9, color: "#555555", marginTop: 4 },
  section: { marginTop: 16 },
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  table: { marginTop: 12, border: "1px solid #cccccc" },
  row: { flexDirection: "row", borderBottom: "1px solid #eeeeee" },
  rowLast: { flexDirection: "row" },
  cellLabel: { width: "50%", padding: 6, backgroundColor: "#f7f7f7", fontFamily: "Helvetica-Bold" },
  cellValue: { width: "50%", padding: 6 },
  footer: { marginTop: 32, fontSize: 8, color: "#888888", borderTop: "1px solid #eeeeee", paddingTop: 8 },
});

export function LoanLetterPDF({ data }: { data: LoanLetterPDFData }) {
  const rows: [string, string][] = [
    ["Application Number", data.applicationNumber],
    ["Loan Product", data.productName],
    ["Approved Amount", `₹${data.approvedAmount}`],
    ["Tenure", `${data.approvedTenureMonths} months`],
    ["Interest Rate", `${data.interestRateOffered}% p.a.`],
    ["EMI Amount", `₹${data.emiAmount}`],
    ["Processing Fee", `₹${data.processingFee}`],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.lenderName}>{data.lenderName}</Text>
          <Text style={styles.title}>{data.letterTitle}</Text>
          <Text style={styles.meta}>Issued {data.issuedAt} · Version {data.version}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>Dear {data.customerName},</Text>
          <Text style={styles.paragraph}>
            We are pleased to inform you that your application {data.applicationNumber} for a {data.productName} has
            been reviewed and the following terms have been {data.letterTitle === "Offer Letter" ? "offered" : "sanctioned"}, subject to
            execution of the loan agreement and completion of any remaining conditions.
          </Text>
        </View>

        <View style={styles.table}>
          {rows.map(([label, value], i) => (
            <View key={label} style={i === rows.length - 1 ? styles.rowLast : styles.row}>
              <Text style={styles.cellLabel}>{label}</Text>
              <Text style={styles.cellValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.paragraph}>
            This letter is valid subject to the terms and conditions of the final loan agreement. Disbursement is
            contingent on execution of the agreement and satisfaction of all conditions precedent.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>This is a system-generated document and does not require a physical signature.</Text>
        </View>
      </Page>
    </Document>
  );
}
