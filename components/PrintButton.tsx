'use client';
import { Icon } from './ui';
export function PrintButton() {
  return <button className="btn ink" onClick={() => window.print()}><Icon name="print" size={20} color="#FFFFFF" />Print or save as PDF</button>;
}
