package com.hms.doctor.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

/** Topics created at startup (SVC-00 section 8.2): 3 partitions, replication 1 for local. */
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic doctorStatusChangedTopic() {
        return TopicBuilder.name("doctor.status-changed").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic doctorAccountRegisteredTopic() {
        return TopicBuilder.name("user.doctor-account-registered").partitions(3).replicas(1).build();
    }
}
