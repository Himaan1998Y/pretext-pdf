// ─── Helper ────────────────────────────────────────────────────────────────────
function row(...cells) {
    return { cells };
}
function cell(text, opts = {}) {
    return { text, ...opts };
}
export function createInvoice(data) {
    const currency = data.currency ?? '$';
    const fmt = (n) => `${currency}${n.toFixed(2)}`;
    const subtotal = data.items.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);
    const discount = data.discountAmount ?? 0;
    const taxBase = subtotal - discount;
    const tax = data.taxRate ? taxBase * (data.taxRate / 100) : 0;
    const total = taxBase + tax;
    const elements = [];
    elements.push({ type: 'heading', level: 1, text: 'INVOICE' });
    // From / invoice meta
    const fromText = [data.from.name, data.from.address, data.from.email, data.from.phone].filter(Boolean).join('\n');
    const metaText = [`Invoice #: ${data.invoiceNumber}`, `Date: ${data.date}`, ...(data.dueDate ? [`Due: ${data.dueDate}`] : [])].join('\n');
    elements.push({
        type: 'table',
        columns: [{ width: '*' }, { width: 160 }],
        rows: [row(cell(`From:\n${fromText}`), cell(metaText, { align: 'right' }))],
        spaceAfter: 16,
    });
    const toText = [data.to.name, data.to.address, data.to.email].filter(Boolean).join('\n');
    elements.push({ type: 'paragraph', text: `Bill To:\n${toText}`, spaceAfter: 16 });
    // Line items
    const itemRows = data.items.map(item => {
        const lineTotal = item.total ?? item.quantity * item.unitPrice;
        return row(cell(item.description), cell(String(item.quantity), { align: 'right' }), cell(fmt(item.unitPrice), { align: 'right' }), cell(fmt(lineTotal), { align: 'right' }));
    });
    const summaryRows = [
        row(cell('Subtotal', { colspan: 3, align: 'right', fontWeight: 700 }), cell(fmt(subtotal), { align: 'right' })),
    ];
    if (discount > 0) {
        summaryRows.push(row(cell('Discount', { colspan: 3, align: 'right' }), cell(`-${fmt(discount)}`, { align: 'right' })));
    }
    if (tax > 0) {
        const taxLabel = data.taxLabel ?? 'Tax';
        summaryRows.push(row(cell(`${taxLabel} (${data.taxRate}%)`, { colspan: 3, align: 'right' }), cell(fmt(tax), { align: 'right' })));
    }
    summaryRows.push(row(cell('TOTAL', { colspan: 3, align: 'right', fontWeight: 700 }), cell(fmt(total), { align: 'right', fontWeight: 700 })));
    elements.push({
        type: 'table',
        columns: [{ width: '*' }, { width: 60 }, { width: 80 }, { width: 80 }],
        rows: [
            row(cell('Description', { fontWeight: 700 }), cell('Qty', { fontWeight: 700, align: 'right' }), cell('Unit Price', { fontWeight: 700, align: 'right' }), cell('Total', { fontWeight: 700, align: 'right' })),
            ...itemRows,
            ...summaryRows,
        ],
        spaceAfter: 16,
    });
    if (data.qrData) {
        elements.push({ type: 'paragraph', text: 'Scan to pay:', spaceAfter: 4 });
        elements.push({ type: 'qr-code', data: data.qrData, size: 80, align: 'left', spaceAfter: 12 });
    }
    if (data.paymentInstructions) {
        elements.push({ type: 'paragraph', text: data.paymentInstructions, spaceAfter: 8 });
    }
    if (data.notes) {
        elements.push({ type: 'paragraph', text: `Notes: ${data.notes}` });
    }
    return elements;
}
function formatINR(n) {
    const [integer = '0', decimal = '00'] = n.toFixed(2).split('.');
    const lastThree = integer.slice(-3);
    const rest = integer.slice(0, -3);
    const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
    return `\u20B9${formatted}.${decimal}`;
}
export function createGstInvoice(data) {
    const interState = data.isInterState ?? (data.supplier.state !== data.buyer.state);
    const elements = [];
    elements.push({ type: 'heading', level: 1, text: 'TAX INVOICE', align: 'center' });
    elements.push({ type: 'hr', spaceAfter: 8 });
    const supplierText = [data.supplier.name, data.supplier.address, `GSTIN: ${data.supplier.gstin}`, data.supplier.email, data.supplier.phone].filter(Boolean).join('\n');
    const metaText = [`Invoice No: ${data.invoiceNumber}`, `Date: ${data.invoiceDate}`, ...(data.dueDate ? [`Due: ${data.dueDate}`] : []), `Place of Supply: ${data.placeOfSupply}`].join('\n');
    elements.push({
        type: 'table',
        columns: [{ width: '*' }, { width: 180 }],
        rows: [row(cell(supplierText, { fontWeight: 700 }), cell(metaText, { align: 'right' }))],
        spaceAfter: 8,
    });
    const buyerText = [data.buyer.name, data.buyer.address, `GSTIN: ${data.buyer.gstin}`, `State: ${data.buyer.state}`].join('\n');
    elements.push({ type: 'paragraph', text: 'Bill To:', fontWeight: 700 });
    elements.push({ type: 'paragraph', text: buyerText, spaceAfter: 12 });
    // Items table
    const taxColHeader = interState ? 'IGST %' : 'CGST%+SGST%';
    const taxAmtHeader = interState ? 'IGST Amt' : 'CGST+SGST';
    let totalTaxable = 0;
    let totalTax = 0;
    const itemRows = data.items.map((item, idx) => {
        const taxable = item.quantity * item.rate;
        const tax = taxable * (item.taxRate / 100);
        const lineTotal = taxable + tax;
        totalTaxable += taxable;
        totalTax += tax;
        return row(cell(String(idx + 1)), cell(item.description), cell(item.hsnSac), cell(String(item.quantity), { align: 'right' }), cell(item.unit), cell(formatINR(item.rate), { align: 'right' }), cell(formatINR(taxable), { align: 'right' }), cell(`${item.taxRate}%`, { align: 'right' }), cell(formatINR(tax), { align: 'right' }), cell(formatINR(lineTotal), { align: 'right' }));
    });
    const grandTotal = totalTaxable + totalTax;
    elements.push({
        type: 'table',
        fontSize: 9,
        cellPaddingH: 4,
        columns: [
            { width: 15 }, { width: '*' }, { width: 45 }, { width: 25 },
            { width: 25 }, { width: 55 }, { width: 60 }, { width: 45 }, { width: 55 }, { width: 60 },
        ],
        rows: [
            row(cell('#', { fontWeight: 700 }), cell('Description', { fontWeight: 700 }), cell('HSN/SAC', { fontWeight: 700 }), cell('Qty', { fontWeight: 700, align: 'right' }), cell('Unit', { fontWeight: 700 }), cell('Rate', { fontWeight: 700, align: 'right' }), cell('Taxable', { fontWeight: 700, align: 'right' }), cell(taxColHeader, { fontWeight: 700, align: 'right' }), cell(taxAmtHeader, { fontWeight: 700, align: 'right' }), cell('Total', { fontWeight: 700, align: 'right' })),
            ...itemRows,
            row(cell('Total Taxable', { colspan: 6, align: 'right', fontWeight: 700 }), cell(formatINR(totalTaxable), { align: 'right', fontWeight: 700 }), cell(''), cell(''), cell('')),
            row(cell(`Total ${interState ? 'IGST' : 'CGST+SGST'}`, { colspan: 8, align: 'right' }), cell(formatINR(totalTax), { align: 'right', colspan: 2 })),
            row(cell('Grand Total', { colspan: 9, align: 'right', fontWeight: 700 }), cell(formatINR(grandTotal), { align: 'right', fontWeight: 700 })),
        ],
        spaceAfter: 12,
    });
    elements.push({ type: 'paragraph', text: `Amount in words: ${amountInWords(grandTotal)}`, spaceAfter: 12 });
    if (data.bankName || data.accountNumber) {
        elements.push({ type: 'paragraph', text: 'Bank Details:', fontWeight: 700 });
        const bankLines = [
            data.bankName ? `Bank: ${data.bankName}` : '',
            data.accountNumber ? `A/c No: ${data.accountNumber}` : '',
            data.ifscCode ? `IFSC: ${data.ifscCode}` : '',
        ].filter(Boolean);
        elements.push({ type: 'paragraph', text: bankLines.join('\n'), spaceAfter: 12 });
    }
    if (data.qrUpiData) {
        elements.push({ type: 'paragraph', text: 'Scan to pay via UPI:', spaceAfter: 4 });
        elements.push({ type: 'qr-code', data: data.qrUpiData, size: 80, align: 'left', spaceAfter: 12 });
    }
    if (data.declaration) {
        elements.push({ type: 'blockquote', text: data.declaration });
    }
    return elements;
}
function amountInWords(amount) {
    if (!Number.isFinite(amount) || amount < 0)
        return 'Rupees Zero Only';
    if (amount === 0)
        return 'Rupees Zero Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const twoDigits = (n) => n < 20 ? (ones[n] ?? '') : (tens[Math.floor(n / 10)] ?? '') + (n % 10 ? ' ' + (ones[n % 10] ?? '') : '');
    const threeDigits = (n) => n >= 100 ? (ones[Math.floor(n / 100)] ?? '') + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '') : twoDigits(n);
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let words = '';
    if (rupees >= 10_000_000)
        words += threeDigits(Math.floor(rupees / 10_000_000)) + ' Crore ';
    if (rupees % 10_000_000 >= 100_000)
        words += threeDigits(Math.floor((rupees % 10_000_000) / 100_000)) + ' Lakh ';
    if (rupees % 100_000 >= 1_000)
        words += threeDigits(Math.floor((rupees % 100_000) / 1_000)) + ' Thousand ';
    const rem = rupees % 1_000;
    if (rem >= 100)
        words += threeDigits(Math.floor(rem / 100)) + ' Hundred ';
    words += twoDigits(rem % 100);
    // Use explicit "Zero" when there are no rupees (sub-rupee amounts) to avoid
    // emitting "Rupees  and Fifty Paise Only" with a double space.
    const rupeeWords = words.trim() || 'Zero';
    let result = 'Rupees ' + rupeeWords;
    if (paise > 0)
        result += ' and ' + twoDigits(paise) + ' Paise';
    return result + ' Only';
}
export function createReport(data) {
    const elements = [];
    elements.push({ type: 'heading', level: 1, text: data.title, align: 'center' });
    if (data.subtitle) {
        elements.push({ type: 'paragraph', text: data.subtitle, align: 'center', spaceAfter: 4 });
    }
    const meta = [data.author, data.date].filter(Boolean).join(' · ');
    if (meta) {
        elements.push({ type: 'paragraph', text: meta, align: 'center', spaceAfter: 16 });
    }
    if (data.abstract) {
        elements.push({ type: 'blockquote', text: data.abstract, spaceAfter: 12 });
    }
    if (data.includeTableOfContents) {
        elements.push({ type: 'toc' });
        elements.push({ type: 'page-break' });
    }
    for (const section of data.sections) {
        elements.push({ type: 'heading', level: section.level ?? 2, text: section.title });
        for (const para of section.paragraphs) {
            elements.push({ type: 'paragraph', text: para, spaceAfter: 8 });
        }
        if (section.bullets && section.bullets.length > 0) {
            elements.push({
                type: 'list',
                style: 'unordered',
                items: section.bullets.map(b => ({ text: b })),
                spaceAfter: 8,
            });
        }
    }
    return elements;
}
//# sourceMappingURL=templates.js.map