import { DataTypes } from 'sequelize';

export function defineSale(sequelize) {
  return sequelize.define('Sale', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sale_number: { type: DataTypes.STRING },
    client_id: { type: DataTypes.UUID },
    client_name: { type: DataTypes.STRING },
    client_phone: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING, defaultValue: 'vente' },
    items: { type: DataTypes.JSON, defaultValue: [] },
    subtotal: { type: DataTypes.FLOAT, defaultValue: 0 },
    discount_total: { type: DataTypes.FLOAT, defaultValue: 0 },
    total: { type: DataTypes.FLOAT, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING },
    payments: { type: DataTypes.JSON, defaultValue: [] },
    status: { type: DataTypes.STRING, defaultValue: 'completee' },
    notes: { type: DataTypes.TEXT },
    cashier: { type: DataTypes.STRING },
    promo_code: { type: DataTypes.STRING },
    promo_discount: { type: DataTypes.FLOAT, defaultValue: 0 },
  }, { tableName: 'sales' });
}
