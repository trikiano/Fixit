import { DataTypes } from 'sequelize';

export function defineSubscription(sequelize) {
  return sequelize.define('Subscription', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shop_id: { type: DataTypes.UUID, allowNull: false },
    plan: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'cancelled', 'expired'),
      defaultValue: 'active'
    },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    ends_at: { type: DataTypes.DATE },
    amount: { type: DataTypes.FLOAT },
    notes: { type: DataTypes.TEXT },
  }, { tableName: 'subscriptions', timestamps: true, createdAt: 'created_date', updatedAt: 'updated_date' });
}
