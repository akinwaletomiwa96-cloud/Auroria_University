//package edu.auroria.auroria_backend;
//
//import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
//
//public class PasswordGenerator {
//
//    public static void main(String[] args) {
//
//        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
//
//        String password = "AuroriaStaff@2026";
//        String hash = encoder.encode(password);
//
//        System.out.println(hash);
//        System.out.println("Hash length: " + hash.length());
//        System.out.println(
//                "Password verified: " + encoder.matches(password, hash)
//        );
//    }
//}