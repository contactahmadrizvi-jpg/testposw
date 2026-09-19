import type { Order, OrderItem } from "@/types";
import { formatCurrency, parseDate } from "@/lib/utils";
import { RESTAURANT } from "@/constants";
import { getSettings } from "@/services/settings.service";

export type PrintHeader = {
  name: string;
  location: string;
  phone: string;
  phone2?: string;
  logoUrl?: string;
};

let cachedHeader: PrintHeader | null = null;
let printChain: Promise<void> = Promise.resolve();
let isPrinting = false;
let printTimeout: NodeJS.Timeout | null = null;
let lastPrinterCheck = 0;
let printerAvailable = true;

// Safety: Reset isPrinting flag after 30 seconds if stuck
function safetyResetPrintFlag() {
  if (printTimeout) clearTimeout(printTimeout);
  printTimeout = setTimeout(() => {
    if (isPrinting) {
      console.warn('[Print] Safety reset: isPrinting flag was stuck, resetting...');
      isPrinting = false;
    }
  }, 30000); // 30 seconds timeout
}

// Check if printer is available (every 5 minutes)
async function checkPrinterAvailability(): Promise<boolean> {
  const now = Date.now();
  if (now - lastPrinterCheck < 300000) { // 5 minutes
    return printerAvailable;
  }
  
  lastPrinterCheck = now;
  
  try {
    // Try to detect if browser supports printing
    if (!window.print) {
      console.error('[Print] Browser does not support printing');
      printerAvailable = false;
      return false;
    }
    
    // Check if we're in a print-friendly environment
    if (typeof document === 'undefined') {
      printerAvailable = false;
      return false;
    }
    
    printerAvailable = true;
    return true;
  } catch (err) {
    console.error('[Print] Printer check failed:', err);
    printerAvailable = false;
    return false;
  }
}

function formatOrderLabel(order: Order): string {
  const n = order.dailyOrderNumber ?? order.orderNumber;
  return `#${n}`;
}

function formatReceiptDateTime(iso: string): string {
  const d = parseDate(iso);
  if (!d) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  
  // Convert to 12-hour format
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(hours)}:${pad(minutes)} ${ampm}`;
}

function orderTypeLabel(type: Order["type"]): string {
  if (type === "dine_in") return "DINE IN";
  if (type === "takeaway") return "TAKEAWAY";
  if (type === "delivery") return "DELIVERY";
  return "ONLINE";
}

export async function preloadPrintHeader(): Promise<PrintHeader> {
  if (cachedHeader) return cachedHeader;
  cachedHeader = await resolvePrintHeader();
  return cachedHeader;
}

async function resolvePrintHeader(): Promise<PrintHeader> {
  try {
    const settings = await getSettings();
    if (settings) {
      return {
        name: (settings.printerSettings?.restaurantName ?? settings.name).toUpperCase(),
        location: RESTAURANT.location.toUpperCase(),
        phone: "03258804325",
        phone2: "03174957068",
        logoUrl: settings.logoUrl,
      };
    }
  } catch {
    /* defaults */
  }
  return {
    name: RESTAURANT.name.toUpperCase(),
    location: RESTAURANT.location.toUpperCase(),
    phone: "03258804325",
    phone2: "03174957068",
  };
}

/** One print dialog: receipt + KOT (page break). No duplicate popups. */
export async function printPosDocuments(order: Order, header?: PrintHeader): Promise<void> {
  const h = header ?? (await preloadPrintHeader());
  const html = `${buildReceiptHTML(order, h)}<div style="page-break-before:always"></div>${buildKOTBody(order)}`;
  await enqueuePrint(wrapPrintDocument(html, `Order ${formatOrderLabel(order)}`));
}

export async function printReceipt(order: Order, header?: PrintHeader): Promise<void> {
  const h = header ?? (await preloadPrintHeader());
  await enqueuePrint(wrapPrintDocument(buildReceiptHTML(order, h), `Receipt ${formatOrderLabel(order)}`));
}

export async function printKOT(order: Order): Promise<void> {
  await enqueuePrint(wrapPrintDocument(buildKOTBody(order), `KOT ${formatOrderLabel(order)}`));
}

function enqueuePrint(html: string): Promise<void> {
  // If stuck for too long, force reset
  if (isPrinting) {
    console.warn('[Print] Already printing, queuing...');
  }
  
  const job = printChain.then(() => printHtmlOnce(html));
  printChain = job.catch((err) => {
    console.error('[Print] Print job failed:', err);
    // Ensure flag is reset on error
    isPrinting = false;
    if (printTimeout) clearTimeout(printTimeout);
  });
  return job;
}

function printHtmlOnce(html: string): Promise<void> {
  if (isPrinting) {
    console.log('[Print] Waiting for current print to finish...');
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isPrinting) {
          clearInterval(checkInterval);
          resolve(printHtmlOnce(html));
        }
      }, 500);
      // Safety: Don't wait forever
      setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('[Print] Timeout waiting for print, forcing...');
        isPrinting = false;
        resolve(printHtmlOnce(html));
      }, 10000);
    });
  }
  
  isPrinting = true;
  safetyResetPrintFlag(); // Start safety timer

  return new Promise(async (resolve) => {
    // Check printer availability
    const available = await checkPrinterAvailability();
    if (!available) {
      console.error('[Print] Printer not available, please check browser settings');
      alert('⚠️ Printer not available!\n\nPlease check:\n1. Browser has permission to print\n2. Default printer is set\n3. Printer is connected\n\nThen refresh the page and try again.');
      isPrinting = false;
      if (printTimeout) clearTimeout(printTimeout);
      resolve();
      return;
    }

    const iframe = document.createElement("iframe");
    // Give iframe a real 58mm width (≈220px at 96dpi) so the browser renders
    // at the correct thermal-paper width. Zero width causes the browser to
    // fall back to screen width then print a huge blank A4-height page.
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:58mm;height:1px;border:0;opacity:0;pointer-events:none;";
    
    try {
      document.body.appendChild(iframe);
    } catch (err) {
      console.error('[Print] Failed to create print iframe:', err);
      isPrinting = false;
      if (printTimeout) clearTimeout(printTimeout);
      resolve();
      return;
    }

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!doc || !win) {
      console.error('[Print] Failed to access iframe window/document');
      isPrinting = false;
      if (printTimeout) clearTimeout(printTimeout);
      iframe.remove();
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Guard: runPrint must only execute once even if both the
    // readyState===complete branch AND iframe.onload fire.
    let hasPrinted = false;
    const done = () => {
      isPrinting = false;
      if (printTimeout) clearTimeout(printTimeout);
      setTimeout(() => {
        try {
          iframe.remove();
        } catch (err) {
          console.warn('[Print] Failed to remove iframe:', err);
        }
      }, 500);
      resolve();
    };

    const runPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      // Remove onload handler to prevent any late fires
      iframe.onload = null;
      
      try {
        console.log('[Print] Triggering print dialog...');
        win.focus();
        win.print();
        console.log('[Print] Print dialog opened successfully');
      } catch (err) {
        console.error('[Print] Print failed:', err);
        alert('⚠️ Print Failed!\n\nError: ' + (err as Error).message + '\n\nPlease check your printer connection and browser settings.');
      } finally {
        done();
      }
    };

    // Safety: If print doesn't happen within 5 seconds, force cleanup
    const printSafetyTimeout = setTimeout(() => {
      if (!hasPrinted) {
        console.warn('[Print] Print dialog timeout, forcing cleanup...');
        runPrint();
      }
    }, 5000);

    if (doc.readyState === "complete") {
      clearTimeout(printSafetyTimeout);
      runPrint();
    } else {
      iframe.onload = () => {
        clearTimeout(printSafetyTimeout);
        runPrint();
      };
    }
  });
}

function wrapPrintDocument(body: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page { size: 58mm auto; margin: 0mm; }
* { box-sizing: border-box; }
html, body { height: auto !important; overflow: visible !important; margin: 0; padding: 0; background: #fff; }
@media print {
  html, body { margin: 0; padding: 0; }
}
</style></head><body>${body}</body></html>`;
}

function itemExtras(item: OrderItem): string {
  const c = item.customization;
  if (!c) return "";
  const parts: string[] = [];
  if (c.variantName) parts.push(c.variantName);
  if (c.addonNames?.length) parts.push(c.addonNames.join(", "));
  if (c.extraCheese) parts.push("Extra cheese");
  if (c.spiceLevel) parts.push(c.spiceLevel);
  if (c.notes) parts.push(c.notes);
  return `<div class="item-note">${escapeHtml(parts.join(" · "))}</div>`;
}

function buildReceiptHTML(order: Order, header: PrintHeader): string {
  const label = formatOrderLabel(order);
  const dt = formatReceiptDateTime(order.createdAt);
  const tableLine =
    order.tableNumber != null
      ? `<table class="w-table"><tr><td>TABLE</td><td class="text-right">${order.tableNumber}</td></tr></table>`
      : `<table class="w-table"><tr><td>TYPE</td><td class="text-right">${orderTypeLabel(order.type)}</td></tr></table>`;

  const itemRows = order.items
    .map(
      (i) => `
    <table class="w-table item-table">
      <tr>
        <td class="item-name">${i.quantity}X ${escapeHtml(i.name.toUpperCase())}</td>
        <td class="item-price text-right">${formatCurrency(i.subtotal)}</td>
      </tr>
    </table>${itemExtras(i)}`
    )
    .join("");

  const addr = order.deliveryAddress
    ? `<div class="addr">${escapeHtml(order.deliveryAddress.street)}, ${escapeHtml(order.deliveryAddress.area)}, ${escapeHtml(order.deliveryAddress.city)}</div>`
    : "";

  // Use absolute URL for logo so it works in print iframe
  const logoUrl = `${window.location.origin}/logo.png`;
  const logo = `<img src="${logoUrl}" class="logo-img" alt="SOMO Logo" onerror="this.onerror=null;this.src='${escapeHtml(header.logoUrl || "")}';this.style.maxHeight='28px';" />`;

  return `
<style>
  html { height: auto !important; overflow: visible !important; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10px;
    width: 44mm;
    max-width: 44mm;
    height: auto !important;
    overflow: visible !important;
    margin: 0;
    padding: 0 2px 0 0;
    color: #000;
    background: #fff;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .center { text-align: center; }
  .text-right { text-align: right; }
  .logo-icon { font-size: 16px; margin-bottom: 2px; }
  .logo-img { 
    max-height: 40px; 
    max-width: 100%;
    width: auto;
    height: auto;
    margin: 0 auto 6px; 
    display: block; 
    object-fit: contain;
  }
  .brand { font-size: 12px; font-weight: 800; letter-spacing: 0.04em; word-break: break-word; overflow-wrap: break-word; }
  .sub { font-size: 8px; margin-top: 1px; line-height: 1.2; font-weight: 500; word-break: break-word; overflow-wrap: break-word; }
  .rule { border: none; border-top: 1px solid #000; margin: 4px 0; }
  .rule-dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .datetime { font-size: 9px; margin: 3px 0; font-weight: 500; }
  .w-table { width: 100%; border-collapse: collapse; font-size: 9px; margin: 2px 0; table-layout: fixed; }
  .w-table td { vertical-align: top; overflow-wrap: break-word; word-break: break-word; }
  .item-table { margin: 4px 0; font-size: 9px; }
  .item-name { font-weight: 700; width: 70%; }
  .item-price { font-weight: 700; width: 30%; white-space: nowrap; }
  .item-note { font-size: 8px; margin: -1px 0 3px 6px; text-transform: none; font-weight: 500; word-break: break-word; overflow-wrap: break-word; }
  .totals { margin: 3px 0; }
  .total-big td { font-size: 11px; font-weight: 800; padding-top: 3px; border-top: 1.5px solid #000; }
  .pay-grid { font-size: 9px; margin-top: 4px; }
  .footer { text-align: center; font-size: 8px; margin-top: 6px; line-height: 1.3; font-weight: 500; }
  .addr { font-size: 8px; margin: 3px 0; text-transform: none; word-break: break-word; overflow-wrap: break-word; }
  .customer { font-size: 8px; margin: 3px 0; text-transform: none; word-break: break-word; overflow-wrap: break-word; font-weight: 600; }
</style>
<div class="center" style="margin-top: 0px; padding-top: 0px;">${logo}</div>
<div class="center brand">${escapeHtml(header.name)}</div>
<div class="center sub">${escapeHtml(header.location)}</div>
<div class="center sub">📞 ${escapeHtml(header.phone)}</div>
${header.phone2 ? `<div class="center sub">📞 ${escapeHtml(header.phone2)}</div>` : ""}
<hr class="rule" />
<div class="center datetime">${dt}</div>
<table class="w-table"><tr><td>RECEIPT</td><td class="text-right">${label}</td></tr></table>
${tableLine}
<div class="customer">${escapeHtml(order.customerName)} · ${escapeHtml(order.customerPhone)}</div>
${addr}
${order.deliveryNotes ? `<div class="customer">NOTES: ${escapeHtml(order.deliveryNotes)}</div>` : ""}
<hr class="rule-dash" />
${itemRows}
<hr class="rule" />
<div class="totals">
  <table class="w-table"><tr><td>SUBTOTAL</td><td class="text-right">${formatCurrency(order.subtotal)}</td></tr></table>
  ${order.discount > 0 ? `<table class="w-table"><tr><td>DISCOUNT</td><td class="text-right">-${formatCurrency(order.discount)}</td></tr></table>` : ""}
  ${order.tax > 0 ? `<table class="w-table"><tr><td>TAX</td><td class="text-right">${formatCurrency(order.tax)}</td></tr></table>` : ""}
  ${order.deliveryCharge > 0 ? `<table class="w-table"><tr><td>DELIVERY</td><td class="text-right">${formatCurrency(order.deliveryCharge)}</td></tr></table>` : ""}
  <table class="w-table total-big"><tr><td>TOTAL</td><td class="text-right">${formatCurrency(order.total)}</td></tr></table>
</div>
<hr class="rule-dash" />
<div class="pay-grid">
  <table class="w-table"><tr><td>PAYMENT METHOD</td><td class="text-right">${order.paymentMethod.toUpperCase()} (${order.paymentStatus.toUpperCase()})</td></tr></table>
</div>
<div class="footer">
  THANK YOU FOR YOUR VISIT!<br/>
  PLEASE COME AGAIN!
</div>
</div>`;
}

function buildKOTBody(order: Order): string {
  const label = formatOrderLabel(order);
  
  // Use absolute URL for logo so it works in print iframe
  const logoUrl = `${window.location.origin}/logo.png`;
  const logo = `<img src="${logoUrl}" class="kot-logo" alt="SOMO Logo" onerror="this.style.display='none';" />`;
  
  const items = order.items
    .map((i) => {
      const variantPart = i.customization?.variantName ? ` (${escapeHtml(i.customization.variantName)})` : "";
      const addonPart = i.customization?.addonNames?.length ? i.customization.addonNames.join(", ") : "";
      const extrasParts: string[] = [];
      if (addonPart) extrasParts.push(addonPart);
      if (i.customization?.extraCheese) extrasParts.push("Extra Cheese");
      if (i.customization?.spiceLevel) extrasParts.push(i.customization.spiceLevel);
      if (i.customization?.notes) extrasParts.push(i.customization.notes);
      const extrasLine = extrasParts.length > 0
        ? `<div class="item-note">${escapeHtml(extrasParts.join(" · "))}</div>`
        : "";
      return `
    <div class="kot-item">
      <div class="kot-qty">${i.quantity} × ${escapeHtml(i.name)}${variantPart}</div>
      ${extrasLine}
    </div>`;
    })
    .join("");
  return `
<style>
  html { height: auto !important; overflow: visible !important; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10px;
    width: 44mm;
    max-width: 44mm;
    height: auto !important;
    overflow: visible !important;
    margin: 0;
    padding: 0;
    color: #000;
    text-transform: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  h1 { font-size: 11px; margin: 0 0 3px; font-weight: 800; }
  .kot-logo {
    max-height: 36px;
    max-width: 100%;
    width: auto;
    height: auto;
    margin: 0 auto 6px;
    display: block;
    object-fit: contain;
  }
  .badge { display: inline-block; padding: 1px 4px; font-size: 8px; font-weight: 700; color: #fff; background: ${order.source === "website" ? "#1d4ed8" : "#15803d"}; }
  .order-no { font-size: 24px; font-weight: 900; margin: 2px 0; line-height: 1; }
  .kot-item { border-bottom: 2px dashed #000; padding: 4px 0; }
  .kot-qty { font-size: 12px; font-weight: 800; word-break: break-word; overflow-wrap: break-word; white-space: normal; }
  .item-note { font-size: 10px; font-weight: 700; color: #b45309; margin-top: 2px; word-break: break-word; overflow-wrap: break-word; }
</style>
${logo}
<h1 style="margin-top: 0px; padding-top: 0px;">KITCHEN ORDER TICKET</h1>
<span class="badge">${order.source === "website" ? "ONLINE" : "POS"}</span>
<div class="order-no">${label}</div>
<p><strong>${orderTypeLabel(order.type)}</strong>${order.tableNumber != null ? ` · Table ${order.tableNumber}` : ""}</p>
<p style="font-size:11px">${formatReceiptDateTime(order.createdAt)}</p>
<p><strong>${escapeHtml(order.customerName)}</strong><br/>${escapeHtml(order.customerPhone)}</p>
<hr style="border:none;border-top:2px solid #000;margin:6px 0"/>
${items}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function playOrderSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* ignore */
  }
}
