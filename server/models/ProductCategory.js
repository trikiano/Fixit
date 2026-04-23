import { DataTypes } from 'sequelize';

export const defineProductCategory = (sequelize) => {
  return sequelize.define('ProductCategory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    color: { type: DataTypes.STRING(20), defaultValue: '#6366f1' },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    shop_id: { type: DataTypes.UUID, allowNull: true },
  });
};
