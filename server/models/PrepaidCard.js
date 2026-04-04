import { DataTypes } from 'sequelize';

export function definePrepaidCard(sequelize) {
  return sequelize.define('PrepaidCard', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    card_number: { type: DataTypes.STRING },
    client_id: { type: DataTypes.UUID },
    client_name: { type: DataTypes.STRING },
    client_phone: { type: DataTypes.STRING },
    service_item_id: { type: DataTypes.UUID },
    service_name: { type: DataTypes.STRING },
    total_sessions: { type: DataTypes.INTEGER, defaultValue: 0 },
    used_sessions: { type: DataTypes.INTEGER, defaultValue: 0 },
    remaining_sessions: { type: DataTypes.INTEGER, defaultValue: 0 },
    sell_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'active' },
    purchase_date: { type: DataTypes.DATEONLY },
    expiry_date: { type: DataTypes.DATEONLY },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'prepaid_cards' });
}
