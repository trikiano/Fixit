import { DataTypes } from 'sequelize';

export const defineDeviceType = (sequelize) => {
  return sequelize.define('DeviceType', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  });
};
