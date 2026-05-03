import type { ContentElement } from './types.js';
export interface InvoiceParty {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
    taxId?: string;
}
export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total?: number;
}
export interface InvoiceData {
    from: InvoiceParty;
    to: InvoiceParty;
    invoiceNumber: string;
    date: string;
    dueDate?: string;
    items: InvoiceLineItem[];
    currency?: string;
    taxRate?: number;
    taxLabel?: string;
    discountAmount?: number;
    notes?: string;
    paymentInstructions?: string;
    qrData?: string;
}
export declare function createInvoice(data: InvoiceData): ContentElement[];
export interface GstParty {
    name: string;
    address: string;
    gstin: string;
    state: string;
    email?: string;
    phone?: string;
}
export interface GstLineItem {
    description: string;
    hsnSac: string;
    quantity: number;
    unit: string;
    rate: number;
    taxRate: number;
}
export interface GstInvoiceData {
    supplier: GstParty;
    buyer: GstParty;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    placeOfSupply: string;
    items: GstLineItem[];
    isInterState?: boolean;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    declaration?: string;
    qrUpiData?: string;
}
export declare function createGstInvoice(data: GstInvoiceData): ContentElement[];
export interface ReportSection {
    title: string;
    level?: 1 | 2;
    paragraphs: string[];
    bullets?: string[];
}
export interface ReportData {
    title: string;
    subtitle?: string;
    author?: string;
    date?: string;
    abstract?: string;
    sections: ReportSection[];
    includeTableOfContents?: boolean;
}
export declare function createReport(data: ReportData): ContentElement[];
//# sourceMappingURL=templates.d.ts.map