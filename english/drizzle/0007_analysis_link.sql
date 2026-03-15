ALTER TABLE book_sentences ADD COLUMN sentence_id INTEGER REFERENCES sentences(id);
CREATE INDEX idx_book_sentences_sentence_id ON book_sentences(sentence_id);
