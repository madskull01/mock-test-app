package com.example.mocktest.service.impl;

import com.example.mocktest.dto.question.*;
import com.example.mocktest.model.Question;
import com.example.mocktest.model.QuestionOption;
import com.example.mocktest.model.Subject;
import com.example.mocktest.model.enums.Difficulty;
import com.example.mocktest.repository.QuestionRepository;
import com.example.mocktest.repository.SubjectRepository;
import com.example.mocktest.service.QuestionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class QuestionServiceImpl implements QuestionService {

    private final QuestionRepository questionRepository;
    private final SubjectRepository subjectRepository;

    @Override
    public AdminQuestionResponse createQuestion(
            Long subjectId,
            CreateQuestionRequest request) {

        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() ->
                        new RuntimeException("Subject not found"));

        validateOptions(request.getOptions());

        Question question = Question.builder()
                .questionText(request.getQuestionText())
                .explanation(request.getExplanation())
                .marks(request.getMarks())
                .negativeMarks(
                        request.getNegativeMarks() != null
                                ? request.getNegativeMarks()
                                : 0)
                .difficulty(request.getDifficulty())
                .active(true)
                .subject(subject)
                .build();

        List<QuestionOption> options =
                request.getOptions()
                        .stream()
                        .map(optionRequest ->
                                QuestionOption.builder()
                                        .optionText(
                                                optionRequest
                                                        .getOptionText())
                                        .correct(
                                                optionRequest.isCorrect())
                                        .question(question)
                                        .build())
                        .toList();

        question.setOptions(options);

        Question savedQuestion =
                questionRepository.save(question);

        return mapToAdminResponse(savedQuestion);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminQuestionResponse getQuestionById(Long id) {

        return mapToAdminResponse(
                getEntityById(id)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminQuestionResponse> getAllQuestions() {

        return questionRepository.findAll()
                .stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminQuestionResponse> getQuestionsBySubject(
            Long subjectId) {

        return questionRepository
                .findBySubjectId(subjectId)
                .stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminQuestionResponse> getQuestionsByDifficulty(
            Difficulty difficulty) {

        return questionRepository
                .findByDifficulty(difficulty)
                .stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Override
    public AdminQuestionResponse updateQuestion(
            Long id,
            UpdateQuestionRequest request) {

        Question question = getEntityById(id);

        validateOptions(request.getOptions());

        question.setQuestionText(
                request.getQuestionText());

        question.setExplanation(
                request.getExplanation());

        question.setMarks(
                request.getMarks());

        question.setNegativeMarks(
                request.getNegativeMarks());

        question.setDifficulty(
                request.getDifficulty());

        question.setActive(
                request.isActive());

        question.getOptions().clear();

        List<QuestionOption> options =
                request.getOptions()
                        .stream()
                        .map(optionRequest ->
                                QuestionOption.builder()
                                        .optionText(
                                                optionRequest
                                                        .getOptionText())
                                        .correct(
                                                optionRequest.isCorrect())
                                        .question(question)
                                        .build())
                        .toList();

        question.getOptions().addAll(options);

        return mapToAdminResponse(
                questionRepository.save(question)
        );
    }

    @Override
    public void deleteQuestion(Long id) {

        Question question = getEntityById(id);

        questionRepository.delete(question);
    }

    private Question getEntityById(Long id) {

        return questionRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Question not found"));
    }

    private void validateOptions(
            @Valid @NotNull @Size List<CreateQuestionOptionRequest> options) {

        if (options == null || options.size() != 4) {

            throw new RuntimeException(
                    "Question must contain exactly 4 options");
        }

        long correctCount =
                options.stream()
                        .filter(CreateQuestionOptionRequest::isCorrect)
                        .count();

        if (correctCount != 1) {

            throw new RuntimeException(
                    "Question must contain exactly one correct option");
        }
    }

    private AdminQuestionResponse mapToAdminResponse(
            Question question) {

        List<QuestionOptionResponse> options =
                question.getOptions()
                        .stream()
                        .map(option ->
                                QuestionOptionResponse.builder()
                                        .id(option.getId())
                                        .optionText(
                                                option.getOptionText())
                                        .correct(
                                                option.isCorrect())
                                        .build())
                        .toList();

        return AdminQuestionResponse.builder()
                .id(question.getId())
                .questionText(
                        question.getQuestionText())
                .explanation(
                        question.getExplanation())
                .marks(question.getMarks())
                .negativeMarks(
                        question.getNegativeMarks())
                .difficulty(
                        question.getDifficulty())
                .active(question.isActive())
                .subjectId(
                        question.getSubject().getId())
                .subjectName(
                        question.getSubject().getName())
                .options(options)
                .build();
    }
}