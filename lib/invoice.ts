export type InvoiceItemInput = {
  description: string;
  quantity: number;
  rate: number;
};

export function calculateInvoiceTotals(items: InvoiceItemInput[], gstRate: number) {
  const normalizedItems = items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.rate) || 0);
    return {
      description: String(item.description ?? "").trim(),
      quantity,
      rate,
      amount: Math.round(quantity * rate * 100) / 100,
    };
  });
  const subtotal = Math.round(normalizedItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const safeGstRate = Math.min(100, Math.max(0, Number(gstRate) || 0));
  const gstAmount = Math.round((subtotal * safeGstRate) / 100 * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;
  return { items: normalizedItems, gstRate: safeGstRate, subtotal, gstAmount, total };
}
