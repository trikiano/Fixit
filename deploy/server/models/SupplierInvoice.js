import { DataTypes } from 'sequelize';

export function defineSupplierInvoice(sequelize) {
  return sequelize.define('SupplierInvoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    invoice_number: { type: DataTypes.STRING },
    supplier_id: { type: DataTypes.UUID },
    supplier_name: { type: DataTypes.STRING },
    items: { type: DataTypes.JSON, defaultValue: [] },
    total_amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    amount_paid: { type: DataTypes.FLOAT, defaultValue: 0 },
    remaining_debt: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'en_attente' },
    due_date: { type: DataTypes.DATE },
    paid_date: { type: DataTypes.DATE },
    payments: { type: DataTypes.JSON, defaultValue: [] },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'supplier_invoices' });
}
