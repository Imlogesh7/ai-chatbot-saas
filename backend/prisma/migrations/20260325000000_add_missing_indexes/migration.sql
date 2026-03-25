-- AddIndex: Document status
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- AddIndex: Document chatbotId + status composite
CREATE INDEX "documents_chatbot_id_status_idx" ON "documents"("chatbot_id", "status");

-- AddIndex: Conversation updatedAt
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- AddIndex: Message conversationId + createdAt composite
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
