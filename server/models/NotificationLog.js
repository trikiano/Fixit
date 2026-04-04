import { DataTypes } from 'sequelize';

export function defineNotificationLog(sequelize) {
  return sequelize.define('NotificationLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    type: { type: DataTypes.ENUM('email', 'sms', 'whatsapp', 'interne'), defaultValue: 'interne' },
    recipient: { type: DataTypes.STRING },
    recipient_name: { type: DataTypes.STRING },
    subject: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('en_attente', 'envoye', 'echoue'), defaultValue: 'en_attente' },
    entity_type: { type: DataTypes.STRING },
    entity_id: { type: DataTypes.UUID },
    created_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, { 
    tableName: 'notification_logs',
    timestamps: true,
    createdAt: 'created_date',
    updatedAt: 'updated_date'
  });
}
