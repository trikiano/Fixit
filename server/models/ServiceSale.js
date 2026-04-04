import { DataTypes } from 'sequelize';

export function defineServiceSale(sequelize) {
  return sequelize.define('ServiceSale', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    service_item_id: { type: DataTypes.UUID },
    service_name: { type: DataTypes.STRING },
    client_id: { type: DataTypes.UUID },
    client_name: { type: DataTypes.STRING },
    client_phone: { type: DataTypes.STRING },
    sell_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    total: { type: DataTypes.FLOAT, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING },
    card_id: { type: DataTypes.UUID },
    status: { type: DataTypes.STRING, defaultValue: 'completee' },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'service_sales' });
}
