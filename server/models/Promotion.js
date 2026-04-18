import { DataTypes } from 'sequelize';

export function definePromotion(sequelize) {
  return sequelize.define('Promotion', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    code: { type: DataTypes.STRING },
    type: { type: DataTypes.STRING }, // 'percentage', 'fixed'
    value: { type: DataTypes.FLOAT, defaultValue: 0 },
    min_purchase: { type: DataTypes.FLOAT, defaultValue: 0 },
    max_uses: { type: DataTypes.INTEGER },
    used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
    start_date: { type: DataTypes.DATEONLY },
    end_date: { type: DataTypes.DATEONLY },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    applies_to: { type: DataTypes.STRING }, // 'all', 'category', 'product'
    applies_to_value: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  }, { tableName: 'promotions' });
}
