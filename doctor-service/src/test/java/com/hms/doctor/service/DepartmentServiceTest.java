package com.hms.doctor.service;

import com.hms.doctor.dto.DepartmentRequest;
import com.hms.doctor.exception.BusinessException;
import com.hms.doctor.mapper.DepartmentMapper;
import com.hms.doctor.model.Department;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DepartmentServiceTest {

    @Mock
    private DepartmentMapper departmentMapper;

    @InjectMocks
    private DepartmentService departmentService;

    private Department existing;

    @BeforeEach
    void setUp() {
        existing = new Department();
        existing.setId(1L);
        existing.setDeptName("Cardiology");
        existing.setActive(true);
    }

    @Test
    void create_rejectsDuplicateNameIgnoringCase() {
        when(departmentMapper.findByNameIgnoreCase("cardiology")).thenReturn(existing);

        DepartmentRequest request = new DepartmentRequest();
        request.setDeptName("cardiology");

        assertThatThrownBy(() -> departmentService.create(request, 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DEPARTMENT_EXISTS");

        verify(departmentMapper, never()).insert(any());
    }

    @Test
    void create_succeedsWhenNameIsUnique() {
        when(departmentMapper.findByNameIgnoreCase("Neurology")).thenReturn(null);

        DepartmentRequest request = new DepartmentRequest();
        request.setDeptName("Neurology");

        Department created = departmentService.create(request, 1L);

        assertThat(created.getDeptName()).isEqualTo("Neurology");
        assertThat(created.isActive()).isTrue();
        verify(departmentMapper).insert(any(Department.class));
    }

    @Test
    void deactivate_blockedWhenActiveDoctorsExist() {
        when(departmentMapper.findById(1L)).thenReturn(existing);
        when(departmentMapper.countActiveDoctorsByDepartment(1L)).thenReturn(3L);

        assertThatThrownBy(() -> departmentService.updateStatus(1L, false, 1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "ADM_DEPARTMENT_HAS_DOCTORS");

        verify(departmentMapper, never()).updateStatus(anyLong(), anyBoolean(), any());
    }

    @Test
    void deactivate_allowedWhenNoActiveDoctors() {
        when(departmentMapper.findById(1L)).thenReturn(existing);
        when(departmentMapper.countActiveDoctorsByDepartment(1L)).thenReturn(0L);

        Department result = departmentService.updateStatus(1L, false, 1L);

        assertThat(result.isActive()).isFalse();
        verify(departmentMapper).updateStatus(1L, false, 1L);
    }

    @Test
    void getActiveOrThrow_throwsWhenInactive() {
        existing.setActive(false);
        when(departmentMapper.findById(1L)).thenReturn(existing);

        assertThatThrownBy(() -> departmentService.getActiveOrThrow(1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "DOC_DEPARTMENT_NOT_FOUND");
    }

    @Test
    void getActiveOrThrow_throwsWhenMissing() {
        when(departmentMapper.findById(99L)).thenReturn(null);

        assertThatThrownBy(() -> departmentService.getActiveOrThrow(99L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", "DOC_DEPARTMENT_NOT_FOUND");
    }
}
