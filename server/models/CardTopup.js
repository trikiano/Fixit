import { DataTypes } from 'sequelize';

export function defineCardTopup(sequelize) {
  return sequelize.define('CardTopup', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    card_id: { type: DataTypes.UUID },
    card_number: { type: DataTypes.STRING },
    client_name: { type: DataTypes.STRING },
    sessions_added: { type: DataTypes.INTEGER, defaultValue: 0 },
    amount_paid: { type: DataTypes.FLOAT, defaultValue: 0 },
    payment_method: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'card_topups' });
}
