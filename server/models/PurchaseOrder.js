import { DataTypes } from 'sequelize';

export function definePurchaseOrder(sequelize) {
  return sequelize.define('PurchaseOrder', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    order_number: { type: DataTypes.STRING },
    supplier_id: { type: DataTypes.UUID },
    supplier_name: { type: DataTypes.STRING },
    items: { type: DataTypes.JSON, defaultValue: [] },
    total_amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'brouillon' },
    expected_date: { type: DataTypes.DATE },
    received_date: { type: DataTypes.DATE },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'purchase_orders' });
}
