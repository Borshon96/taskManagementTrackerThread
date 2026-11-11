export type ChannelListItem = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  taskCount: number;
};

export type ChannelMemberView = {
  userId: number;
  name: string;
  email: string;
  addedAt: string;
};
