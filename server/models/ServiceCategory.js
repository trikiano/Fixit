import { DataTypes } from 'sequelize';

export function defineServiceCategory(sequelize) {
  return sequelize.define('ServiceCategory', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    color: { type: DataTypes.STRING },
    icon: { type: DataTypes.STRING },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'service_categories' });
}
