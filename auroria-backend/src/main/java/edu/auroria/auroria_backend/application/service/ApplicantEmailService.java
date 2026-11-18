package edu.auroria.auroria_backend.application.service;

import edu.auroria.auroria_backend.application.entity.ApplicantMessage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class ApplicantEmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    public ApplicantEmailService(
            ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    public String send(ApplicantMessage message) {

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();

        if (mailSender == null || fromEmail == null || fromEmail.isBlank()) {
            return "NOT_CONFIGURED";
        }

        try {
            SimpleMailMessage email = new SimpleMailMessage();

            email.setFrom(fromEmail);
            email.setTo(message.getRecipient().getEmail());
            email.setSubject(message.getSubject());
            email.setText(
                    "Dear " + message.getRecipient().getFullName() + ",\n\n"
                            + message.getBody()
                            + "\n\nAuroria University\nAdmissions Office"
            );

            mailSender.send(email);

            return "SENT";

        } catch (Exception exception) {
            System.err.println("EMAIL SENDING ERROR:");
            exception.printStackTrace();
            return "FAILED: " + exception.getMessage();
        }
    }
}