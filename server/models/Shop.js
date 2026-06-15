import { DataTypes } from 'sequelize';

export function defineShop(sequelize) {
  return sequelize.define('Shop', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.TEXT },
    logo: { type: DataTypes.STRING },
    subscription_status: {
      type: DataTypes.ENUM('trial', 'active', 'suspended', 'demo'),
      defaultValue: 'trial'
    },
    trial_ends_at: { type: DataTypes.DATE },
    plan: {
      type: DataTypes.ENUM('starter', 'pro', 'enterprise'),
      defaultValue: 'starter'
    },
  }, { tableName: 'shops', timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });
}
