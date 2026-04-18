import { DataTypes } from 'sequelize';

export function defineServiceItem(sequelize) {
  return sequelize.define('ServiceItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    category_id: { type: DataTypes.UUID },
    category_name: { type: DataTypes.STRING },
    sell_price: { type: DataTypes.FLOAT, defaultValue: 0 },
    description: { type: DataTypes.TEXT },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    allow_cards: { type: DataTypes.BOOLEAN, defaultValue: false },
    unit: { type: DataTypes.STRING },
  }, { tableName: 'service_items' });
}
